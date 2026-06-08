"""
CAD Drawing Analyzer - Core Analysis Module
Uses Gemini Vision for high-accuracy OCR and analysis.
"""

import base64
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional

import cv2
import numpy as np

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import google.generativeai as genai


class CADAnalyzer:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found")
        
        genai.configure(api_key=self.api_key)
        model_name = os.getenv('GEMINI_MODEL', 'gemini-3.5-flash')
        self.model = genai.GenerativeModel(model_name)
        self.request_timeout_seconds = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "90"))
        self.pdf_request_timeout_seconds = int(os.getenv("GEMINI_PDF_TIMEOUT_SECONDS", "180"))
        self.max_retries = int(os.getenv("GEMINI_MAX_RETRIES", "2"))

    def _pdf_to_high_res_image(self, pdf_bytes: bytes) -> str:
        """Fallback path: rasterize the first page when direct PDF analysis times out."""
        import fitz

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        try:
            page = doc[0]
            pix = page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5))
            img_bytes = pix.tobytes("png")
            return base64.b64encode(img_bytes).decode("utf-8")
        finally:
            doc.close()

    def _is_retryable_error(self, error: Exception) -> bool:
        message = str(error).lower()
        retry_markers = [
            "504",
            "deadline exceeded",
            "timed out",
            "timeout",
            "service unavailable",
            "internal error",
            "temporarily unavailable",
        ]
        return any(marker in message for marker in retry_markers)

    def analyze(self, file_path: str = None, file_bytes: bytes = None,
                filename: str = "drawing.jpg", tolerance_class: str = 'm',
                validation_mode: str = 'ISO', standard_doc_bytes: bytes = None,
                standard_doc_filename: str = None) -> Dict[str, Any]:

        # 1. Standardize input to bytes
        if file_path:
            with open(file_path, 'rb') as f:
                file_bytes = f.read()
            filename = Path(file_path).name

        if not file_bytes:
            return {"success": False, "error": "No file data received"}

        suffix = Path(filename).suffix.lower()

        is_pdf = suffix == '.pdf'

        # 2. Preserve the original PDF bytes so the model can inspect all pages.
        try:
            if is_pdf:
                file_payload = base64.b64encode(file_bytes).decode('utf-8')
                mime_type = 'application/pdf'
            else:
                if suffix in ['.tiff', '.tif']:
                    # Gemini doesn't support image/tiff directly, convert to PNG
                    nparr = np.frombuffer(file_bytes, np.uint8)
                    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                    if img is not None:
                        _, buffer = cv2.imencode('.png', img)
                        file_bytes = buffer.tobytes()
                        mime_type = 'image/png'
                    else:
                        mime_type = 'image/tiff' # Fallback
                elif suffix in ['.jpg', '.jpeg']:
                    mime_type = 'image/jpeg'
                else:
                    mime_type = 'image/png'
                
                file_payload = base64.b64encode(file_bytes).decode('utf-8')

            # 3. Direct API Call with a safety wrapper
            standard_text = ""
            if standard_doc_bytes and standard_doc_filename and validation_mode in ['Org', 'Both']:
                standard_text = self._extract_standard_text(standard_doc_bytes, standard_doc_filename)

            result = self._execute_ai_analysis(file_payload, mime_type, validation_mode, standard_text)
            if result.get("success") is False and is_pdf and self._should_try_pdf_image_fallback(result):
                fallback_result = self._try_pdf_image_fallback(file_bytes, validation_mode, standard_text)
                if fallback_result:
                    result = fallback_result

            # 4. Process visual markup if present
            if result.get("success") and "visual_markup" in result:
                markup = result.get("visual_markup")
                if markup and isinstance(markup, list) and len(markup) > 0:
                    img_b64 = self._draw_visual_markup(file_bytes, is_pdf, markup)
                    if img_b64:
                        result["processed_image_base64"] = f"data:image/jpeg;base64,{img_b64}"

            return result

        except Exception as e:
            return {"success": False, "error": str(e)}

    def _extract_standard_text(self, bytes_data: bytes, filename: str) -> str:
        if not bytes_data:
            return ""
        
        filename_lower = (filename or "").lower()
        if filename_lower.endswith(".pdf"):
            import fitz
            text = ""
            try:
                doc = fitz.open(stream=bytes_data, filetype="pdf")
                for page in doc:
                    text += page.get_text() + "\n"
                doc.close()
                return text.strip()
            except Exception as e:
                return f"Error extracting PDF text: {str(e)}"
        
        elif filename_lower.endswith(".docx"):
            import io
            from docx import Document
            try:
                doc = Document(io.BytesIO(bytes_data))
                return "\n".join([para.text for para in doc.paragraphs])
            except Exception as e:
                return f"Error extracting DOCX text: {str(e)}"
        
        else:
            try:
                return bytes_data.decode('utf-8').strip()
            except Exception:
                return bytes_data.decode('latin-1', errors='ignore').strip()

    def _execute_ai_analysis(self, file_data: str, mime_type: str, validation_mode: str = "ISO", standard_text: str = "") -> Dict[str, Any]:
        """Call Gemini Vision API. Note: Using a single optimized prompt."""
        prompt = self._get_system_prompt(validation_mode, standard_text)
        timeout_seconds = self.pdf_request_timeout_seconds if mime_type == "application/pdf" else self.request_timeout_seconds
        last_error = None

        for attempt in range(self.max_retries + 1):
            try:
                response = self.model.generate_content(
                    [prompt, {'mime_type': mime_type, 'data': file_data}],
                    request_options={"timeout": timeout_seconds}
                )

                if not response or not response.text:
                    return {
                        "success": False,
                        "error": "AI returned an empty response. The drawing might be too complex, blurry, or unsupported."
                    }

                return self._clean_json(response.text, validation_mode)
            except Exception as e:
                last_error = e
                if attempt >= self.max_retries or not self._is_retryable_error(e):
                    break
                time.sleep(min(2 ** attempt, 4))

        return {"success": False, "error": f"AI Request Failed: {str(last_error)}"}

    def _should_try_pdf_image_fallback(self, result: Dict[str, Any]) -> bool:
        message = str(result.get("error", "")).lower()
        return any(marker in message for marker in ["504", "timed out", "timeout", "deadline exceeded"])

    def _try_pdf_image_fallback(self, pdf_bytes: bytes, validation_mode: str, standard_text: str) -> Optional[Dict[str, Any]]:
        try:
            image_payload = self._pdf_to_high_res_image(pdf_bytes)
            fallback_result = self._execute_ai_analysis(image_payload, "image/png", validation_mode, standard_text)
            if isinstance(fallback_result, dict):
                fallback_result.setdefault("_metadata", {})
                fallback_result["_metadata"]["fallback_mode"] = "pdf_first_page_image"
            return fallback_result
        except Exception as e:
            return {
                "success": False,
                "error": f"AI Request Failed: PDF timed out and image fallback also failed: {str(e)}"
            }

    def _draw_visual_markup(self, file_bytes: bytes, is_pdf: bool, visual_markup: list) -> Optional[str]:
        if not visual_markup:
            return None
        try:
            if is_pdf:
                import fitz
                doc = fitz.open(stream=file_bytes, filetype="pdf")
                page = doc[0]
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
                if pix.n == 4:
                    img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGBA2BGR)
                else:
                    img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                doc.close()
            else:
                nparr = np.frombuffer(file_bytes, np.uint8)
                img_cv = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img_cv is None:
                return None

            h, w, _ = img_cv.shape
            overlay = img_cv.copy()

            for item in visual_markup:
                box = item.get('box_2d')
                status = item.get('status', 'error')
                if status == 'valid': continue # Skip valid items, only highlight errors
                if not box or len(box) != 4: continue
                
                ymin, xmin, ymax, xmax = box
                left, top = int(xmin * w / 1000), int(ymin * h / 1000)
                right, bottom = int(xmax * w / 1000), int(ymax * h / 1000)
                
                color = (0, 0, 255) # Red for errors
                
                cv2.rectangle(overlay, (left, top), (right, bottom), color, -1)
                cv2.rectangle(img_cv, (left, top), (right, bottom), color, 3)
                
                label = str(item.get('label', '')).upper()
                if label:
                    font = cv2.FONT_HERSHEY_SIMPLEX
                    font_scale = max(0.4, h / 2500)
                    thickness = max(1, int(h / 1500))
                    text_size, baseline = cv2.getTextSize(label, font, font_scale, thickness)
                    text_w, text_h = text_size
                    
                    pad = 4
                    label_bg_x1 = left
                    label_bg_y1 = top - text_h - (pad * 2)
                    label_bg_x2 = left + text_w + (pad * 2)
                    label_bg_y2 = top
                    
                    # Push label inside box if it goes off top edge
                    if label_bg_y1 < 0:
                        label_bg_y1 = top
                        label_bg_y2 = top + text_h + (pad * 2)
                        
                    cv2.rectangle(img_cv, (label_bg_x1, label_bg_y1), (label_bg_x2, label_bg_y2), color, -1)
                    
                    text_x = label_bg_x1 + pad
                    text_y = label_bg_y2 - pad
                    cv2.putText(img_cv, label, (text_x, text_y), font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA)

            alpha = 0.4
            final_img = cv2.addWeighted(overlay, alpha, img_cv, 1 - alpha, 0)
            
            _, buffer = cv2.imencode('.jpg', final_img, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
            return base64.b64encode(buffer).decode('utf-8')
        except Exception as e:
            print(f"Error drawing visual markup: {e}")
            return None

    def _clean_json(self, text: str, validation_mode: str) -> Dict:
        """Strict JSON extraction"""
        try:
            # Look for the JSON block specifically
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]

            parsed = json.loads(text.strip(), strict=False)
            if isinstance(parsed, dict):
                return self._normalize_analysis(parsed, validation_mode)
            return parsed
        except Exception:
            return {"success": False, "error": "JSON Parse Error", "raw_text": text[:500]}

    def _normalize_analysis(self, parsed: Dict[str, Any], validation_mode: str) -> Dict[str, Any]:
        parsed.setdefault("success", True)
        parsed.setdefault("drawing_info", {})
        parsed.setdefault("standards_identified", [])
        parsed.setdefault("dimensions_with_tolerances", [])
        parsed.setdefault("generic_tolerances_applied", {})
        parsed.setdefault("gdts_identified", [])
        parsed.setdefault("drawing_notations", [])
        parsed.setdefault("manufacturing_requirements", {})
        parsed.setdefault("gauge_requirements", {})
        parsed.setdefault("conclusions", {})
        parsed.setdefault("organizational_standard_violations", [])
        parsed.setdefault("quality_control_issues", [])

        if not parsed.get("technical_report"):
            parsed["technical_report"] = self._build_technical_report(parsed, validation_mode)

        return parsed

    def _build_technical_report(self, analysis: Dict[str, Any], validation_mode: str) -> str:
        info = analysis.get("drawing_info") or {}
        dims = analysis.get("dimensions_with_tolerances") or []
        gdts = analysis.get("gdts_identified") or []
        stds = analysis.get("standards_identified") or []
        notes = analysis.get("drawing_notations") or []
        mfg = analysis.get("manufacturing_requirements") or {}
        gauge = analysis.get("gauge_requirements") or {}
        conc = analysis.get("conclusions") or {}
        org_violations = analysis.get("organizational_standard_violations") or []

        lines = [
            "1. Drawing Information",
            f"Drawing Number: {info.get('drawing_number', 'Unknown')}",
            f"Title: {info.get('title', 'Unknown')}",
            f"Revision: {info.get('revision', 'Unknown')}",
            f"Material: {info.get('material', 'Not specified')}",
            f"Scale: {info.get('scale', 'Not specified')}",
            f"Date: {info.get('date', 'Not specified')}",
            f"Total Pages: {info.get('total_pages', 'Unknown')}",
            "",
            "2. Standards Identified",
        ]

        if stds:
            for std in stds:
                if isinstance(std, dict):
                    lines.append(f"- {std.get('standard', 'Unknown')}: {std.get('description') or std.get('application') or 'No description provided'}")
                else:
                    lines.append(f"- {std}")
        else:
            lines.append("- No standards identified")

        lines.extend(["", "3. Dimensions and Tolerances"])
        if dims:
            for dim in dims:
                if isinstance(dim, dict):
                    feature = dim.get("feature", "Unknown feature")
                    value = dim.get("dimension", "Unknown dimension")
                    tolerance = dim.get("tolerance", "Not specified")
                    critical = "Critical" if dim.get("is_critical") else "Standard"
                    lines.append(f"- {feature}: {value} | Tolerance: {tolerance} | {critical}")
        else:
            lines.append("- No dimensions extracted")

        lines.extend(["", "4. GD&T Review"])
        if gdts:
            for gdt in gdts:
                if isinstance(gdt, dict):
                    lines.append(
                        f"- {gdt.get('feature', 'Unknown feature')}: {gdt.get('type', 'Unknown type')} "
                        f"{gdt.get('value', '')} Datum {gdt.get('datum', 'None')}".strip()
                    )
        else:
            lines.append("- No GD&T symbols identified")

        lines.extend(["", "5. Manufacturing Requirements"])
        special_processes = mfg.get("special_processes") or []
        quality_checks = mfg.get("quality_checks") or []
        surface_finish = mfg.get("surface_finish") or []
        if special_processes:
            for process in special_processes:
                if isinstance(process, dict):
                    lines.append(f"- Process: {process.get('process', 'Unknown')} | Requirement: {process.get('requirement', 'Not specified')}")
        if quality_checks:
            for check in quality_checks:
                if isinstance(check, dict):
                    lines.append(f"- Quality Check: {check.get('check', 'Unknown')} | Method: {check.get('method', 'Not specified')}")
        if surface_finish:
            for finish in surface_finish:
                if isinstance(finish, dict):
                    lines.append(f"- Surface Finish: {finish.get('surface', 'Unknown')} | Ra: {finish.get('ra_value', 'Not specified')} | Process: {finish.get('process', 'Not specified')}")
        if not special_processes and not quality_checks and not surface_finish:
            lines.append("- No additional manufacturing requirements identified")

        lines.extend(["", "6. Gauge Requirements"])
        lines.append(f"Go/No-Go Gauge Required: {'Yes' if gauge.get('requires_go_nogo') else 'No'}")
        dims_needing_gauges = gauge.get("dimensions_needing_gauges") or []
        instruments = gauge.get("measurement_instruments") or []
        lines.append(f"Dimensions Needing Gauges: {', '.join(dims_needing_gauges) if dims_needing_gauges else 'None'}")
        lines.append(f"Measurement Instruments: {', '.join(instruments) if instruments else 'Not specified'}")

        lines.extend(["", "7. Drawing Notes"])
        if notes:
            for note in notes:
                if isinstance(note, dict):
                    lines.append(f"- {note.get('notation', 'Unknown note')} -> {note.get('interpretation', 'No interpretation provided')}")
                else:
                    lines.append(f"- {note}")
        else:
            lines.append("- No additional drawing notes identified")

        lines.extend(["", "8. Conclusions"])
        lines.append(conc.get("summary", "No summary generated"))

        if validation_mode in ["Org", "Both"]:
            lines.extend(["", "9. Standards Validation"])
            lines.append(f"Validation Mode: {validation_mode}")
            if org_violations:
                lines.append("The following deviations from the organizational standard were identified:")
                for v in org_violations:
                    lines.append(f"- Feature: {v.get('feature', 'Unknown')} | Issue: {v.get('violation', 'None')} | Expected: {v.get('expected', 'None')}")
            else:
                lines.append("Drawing complies with the provided organizational standards.")

        # 10. Quality Control (QC) Report
        qc_issues = analysis.get("quality_control_issues") or []
        if qc_issues:
            lines.extend(["", "10. Quality Control (QC) Report"])
            
            iso_issues = []
            org_issues = []
            other = []
            
            for i in qc_issues:
                txt = (i.get('reason', '') + ' ' + i.get('description', '')).upper()
                if 'ISO' in txt: iso_issues.append(i)
                elif 'ORG' in txt or 'ORGANIZATIONAL' in txt: org_issues.append(i)
                else: other.append(i)
                
            if iso_issues:
                lines.append("ISO Standards Compliance:")
                for i in iso_issues:
                    lines.append(f"- [{i.get('severity', 'High')}] {i.get('feature', 'General')}: {i.get('description', '')}")
            
            if org_issues:
                lines.append("Organizational Standards Compliance:")
                for i in org_issues:
                    lines.append(f"- [{i.get('severity', 'High')}] {i.get('feature', 'General')}: {i.get('description', '')}")
            
            if other:
                if iso_issues or org_issues: lines.append("General Engineering / Other Issues:")
                for i in other:
                    lines.append(f"- [{i.get('severity', 'High')}] {i.get('feature', 'General')}: {i.get('description', '')}")

        return "\n".join(lines)

    def _get_system_prompt(self, validation_mode: str = "ISO", standard_text: str = ""):
        base_prompt = """You are an expert mechanical engineer reviewing a CAD/engineering drawing. Perform a comprehensive OCR-based drawing review and analysis.

IMPORTANT RULES:
- ALL OUTPUT MUST BE IN ENGLISH - translate any German, French, or other language text to English
- NEVER return null for any field - use "Not specified", "Unknown", or infer from context
- For dimensions without explicit feature names, describe what they are (e.g., "Shaft diameter", "Bore", "Length")
- For GDT symbols, use the standard Unicode symbols (⌀, ⏤, ⏊, ↗, etc.) or describe them
- Extract the drawing number from the title block - it's usually a code like "Z0W-11763"
- Infer revision from rev/revision field or use "Initial" if not marked
- For drawing_notations: provide the original text AND English translation in the interpretation field
"""
        
        validation_instructions = ""
        if validation_mode == "ISO":
            validation_instructions = """
- STRICT ISO VALIDATION: You MUST ONLY validate the drawing against standard ISO rules (e.g., ISO 2768, ISO 286).
- DO NOT use or mention any organizational-specific rules or documents.
- CHECK FOR MISSING DIMENSIONS: Identify any features that lack necessary size or positional dimensions for manufacturing per ISO.
- CHECK FOR TABULAR ERRORS: Verify all data in Title Blocks and Part Lists (Material, Weight, Rev, Units) against ISO requirements.
- PROVIDE CLEAR REPORTING: For every failure, explicitly state which ISO rule or general engineering practice is violated.
"""
        elif validation_mode == "Org":
            validation_instructions = f"""
- STRICT ORGANIZATIONAL VALIDATION: You MUST ONLY validate the drawing against the provided Organizational Standards document.
- DO NOT use standard ISO rules (like ISO 2768, ISO 286) for validation unless they are explicitly cited in the Org document.
- DO NOT mention "ISO" in your reasons or report unless it is specifically part of the Organizational Standard text.
- Perform a direct 1-to-1 comparison between drawing values and the Org standard values.
- If a feature is NOT mentioned in the Org standard, do NOT mark it as critical or include it in visual_markup unless it is a blatant manufacturing error (missing size).
- If a feature matches the Org standard, it is VALID.

--- ORGANIZATIONAL STANDARDS ---
{standard_text}
--------------------------------
"""
        elif validation_mode == "Both":
            validation_instructions = f"""
- Validate the drawing against standard ISO rules (e.g., ISO 2768, ISO 286).
- ADDITIONALLY, you MUST CROSS-VALIDATE the drawing against the following Organizational Standards document.
- Perform a direct 1-to-1 comparison between the values in the drawing and the values explicitly listed in the standard.
- ANY deviation from ISO or the specific Org rules MUST be flagged as a critical error.
- CHECK FOR MISSING DIMENSIONS: Ensure all features mentioned in the standard are fully dimensioned in the drawing.
- CHECK FOR TABULAR ERRORS: Cross-verify all title block/table fields against the standard.
- If a feature matches the standard, it is VALID.

--- ORGANIZATIONAL STANDARDS ---
{standard_text}
--------------------------------
"""

        distinguish_rule = ""
        if validation_mode == "ISO":
            distinguish_rule = '5. Every error reason MUST start with "ISO Violation: ".'
        elif validation_mode == "Org":
            distinguish_rule = '5. Every error reason MUST start with "Organizational Violation: ". You are FORBIDDEN from using the word "ISO" in any reason or label.'
        else:
            distinguish_rule = '5. Every error reason MUST start with either "ISO Violation: " or "Organizational Violation: " to distinguish the source.'

        schema_part = """
EXTRACT AND RETURN A JSON OBJECT WITH:

1. "drawing_info": {
   "drawing_number": string (from title block, NEVER null),
   "title": string (part name),
   "revision": string (use "A" or "Initial" if not shown),
   "material": string (use "Not specified" if not shown),
   "scale": string,
   "date": string,
   "total_pages": number
}

2. "standards_identified": [
   {
     "standard": string (e.g., "ISO 286", "ISO 2768-m", "DIN 332", "ISO 1940-1"),
     "description": string (what it covers),
     "application": string (how it applies to this drawing)
   }
]

3. "dimensions_with_tolerances": [
   {
     "feature": string (REQUIRED - describe what this dimension is for, e.g., "Shaft OD", "Housing bore", "Flange thickness"),
     "dimension": string (e.g., "Ø265 mm"),
     "tolerance": string (e.g., "H11/h11", "±0.1"),
     "is_critical": boolean (true if tight tolerance like H7, h6, or explicit tolerance),
     "requires_gauge": boolean (true for fits H11 and tighter),
     "critical_reason": string (REQUIRED if is_critical is true. If the feature complies with standards, prefix with "ISO Compliance: " or "Organizational Compliance: ". Use "Violation" only if it is an error.)
   }
]

4. "generic_tolerances_applied": {
   "standard": string (e.g., "ISO 2768-m"),
   "ranges": [
     {"range": "0.5-3 mm", "tolerance": "±0.1 mm"},
     {"range": "3-6 mm", "tolerance": "±0.1 mm"},
     {"range": "6-30 mm", "tolerance": "±0.2 mm"},
     {"range": "30-120 mm", "tolerance": "±0.3 mm"},
     {"range": "120-400 mm", "tolerance": "±0.5 mm"},
     {"range": "400-1000 mm", "tolerance": "±0.8 mm"}
   ]
}

5. "gdts_identified": [
   {
     "feature": string,
     "symbol": string,
     "type": string,
     "value": string,
     "datum": string,
     "is_runout": boolean,
     "is_critical": boolean
   }
]

6. "drawing_notations": [
   {
     "notation": string,
     "interpretation": string
   }
]

7. "manufacturing_requirements": {
   "special_processes": [
     {
       "process": string (e.g., "Seal welding", "Heat treatment", "Dynamic balancing"),
       "requirement": string (specific requirement),
       "standard": string (related standard if any, otherwise "None")
     }
   ],
   "quality_checks": [
     {
       "check": string,
       "method": string,
       "requirement": string
     }
   ],
   "surface_finish": [
     {"surface": string, "ra_value": string, "process": string}
   ]
}

8. "gauge_requirements": {
   "requires_go_nogo": boolean,
   "dimensions_needing_gauges": [string],
   "measurement_instruments": [string]
}

9. "conclusions": {
   "summary": string,
   "critical_features_count": number,
   "special_processes_required": [string],
   "quality_checkpoints": [string]
}

10. "organizational_standard_violations": [
   {
     "feature": string (What violated the standard e.g., "Material", "Title Block", "Tolerance on OD"),
     "violation": string (Detailed description of the deviation),
     "expected": string (What the org standard requires)
   }
]

11. "technical_report": string
Write a human-readable multi-section report in English that summarizes the drawing, extracted dimensions, GD&T, manufacturing requirements, gauge requirements, notable notes, and final conclusions.

12. "visual_markup": [
   {
     "label": string (Field Name or Dimension Name, e.g., "Material", "Mass Units", "Rev Date", "Missing Dimension"),
     "box_2d": [ymin, xmin, ymax, xmax] (bounding box coordinates scaled 0-1000 - MUST BE TIGHTLY CROPPED SUB-BOXES FOR TITLE BLOCK FIELDS),
     "status": "error" | "valid",
     "reason": string (Prefix with "ISO Violation: " or "Organizational Violation: " for errors. Prefix with "ISO Compliance: " or "Organizational Compliance: " for valid items.)
   }
]

13. "quality_control_issues": [
   {
     "issue_type": "Missing Dimension" | "Incorrect Dimension" | "Tabular Error" | "Standard Violation",
     "description": string,
     "feature": string,
     "severity": "High" | "Critical",
     "reason": string (Reference ISO or Org standard)
   }
]

(IMPORTANT for visual_markup: 
1. EXCLUSIVE CATEGORIES: You MUST ONLY generate visual_markup for these categories:
   a) Missing/Incorrect Material (in Title Block)
   b) Wrong/Missing Mass/Weight Units (in Title Block)
   c) Revision Date Issues (Format, Missing, or Incorrect)
   d) Missing Dimensions (Positional or Size dimensions lacking from the drawing)
   e) Missing/Incorrect Projection Symbol (e.g., First Angle symbol missing or incorrect)
   f) Surface Finish Discrepancies (e.g., Ra vs Rz, or incorrect Ra values)
   g) Missing/Incorrect General Tolerance Class (e.g., ISO 2768-m missing or wrong)
   h) Revision Character Non-conformance (e.g., Using "Initial" when a letter/number is required)
2. TIGHT SUB-BOXES: Do NOT highlight the entire Title Block. You MUST generate a tiny, tightly cropped bounding box specifically over the individual field or sub-cell that is failing.
3. For MISSING dimensions, generate a bounding box over the specific region where the dimension is missing.
4. SECTION REFERENCES: For every Organizational Violation, you MUST cite the specific section number from your standard document (e.g., "Per Section 4.2...").
{distinguish_rule}
6. EXACT MATCH: For any dimension, the 'label' in visual_markup MUST be IDENTICAL to the 'feature' name provided in the 'dimensions_with_tolerances' list.)

Be extremely thorough. Extract EVERY piece of information visible. If a PDF has multiple pages, analyze all pages. Return ONLY valid JSON."""

        return base_prompt + validation_instructions + schema_part.replace("{distinguish_rule}", distinguish_rule)



# Convenience function
def analyze_cad_drawing(file_path: str = None, file_bytes: bytes = None,
                        filename: str = "drawing", tolerance_class: str = 'm',
                        api_key: str = None) -> Dict[str, Any]:
    """
    Analyze a CAD drawing and return structured results
    
    Args:
        file_path: Path to drawing file
        file_bytes: Raw bytes of file
        filename: Filename for MIME type detection
        tolerance_class: ISO 2768 class (f, m, c, v)
        api_key: Gemini API key (optional, uses env if not provided)
    
    Returns:
        Dictionary with complete analysis
    """
    analyzer = CADAnalyzer(api_key)
    result = analyzer.analyze(file_path, file_bytes, filename, tolerance_class)
    return result
