"""
CAD Drawing Analyzer - Core Analysis Module.
Uses local Tesseract OCR + OpenCV instead of a remote vision API.
"""

import base64
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import pytesseract
except ImportError:
    pytesseract = None


DIMENSION_RE = re.compile(
    r"(?P<prefix>[Ø⌀RrMm]?\s*)"
    r"(?P<value>\d+(?:[.,]\d+)?)"
    r"(?P<unit>\s*(?:mm|cm|m|in|°|deg)?)"
    r"(?P<tolerance>\s*(?:±|\+/-|\+\s*\d+(?:[.,]\d+)?\s*/\s*-\s*\d+(?:[.,]\d+)?|[A-HJ-NP-Z][0-9]{1,2}|[a-hj-np-z][0-9]{1,2})?)"
)
EXPLICIT_TOLERANCE_RE = re.compile(r"(±|\+/-|\+\s*\d|-\s*\d|[A-HJ-NP-Z][0-9]{1,2}|[a-hj-np-z][0-9]{1,2})")
STANDARD_RE = re.compile(r"\b(?:ISO|DIN|EN|ANSI|ASME)\s*[-A-Z0-9./ ]{2,20}", re.IGNORECASE)
SURFACE_RE = re.compile(r"\b(?:Ra|Rz)\s*\d+(?:[.,]\d+)?", re.IGNORECASE)
DATE_RE = re.compile(r"\b(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})\b")

ISO_2768_RANGES = {
    "f": [("0.5-3 mm", "±0.05 mm"), ("3-6 mm", "±0.05 mm"), ("6-30 mm", "±0.1 mm"), ("30-120 mm", "±0.15 mm"), ("120-400 mm", "±0.2 mm"), ("400-1000 mm", "±0.3 mm")],
    "m": [("0.5-3 mm", "±0.1 mm"), ("3-6 mm", "±0.1 mm"), ("6-30 mm", "±0.2 mm"), ("30-120 mm", "±0.3 mm"), ("120-400 mm", "±0.5 mm"), ("400-1000 mm", "±0.8 mm")],
    "c": [("0.5-3 mm", "±0.2 mm"), ("3-6 mm", "±0.3 mm"), ("6-30 mm", "±0.5 mm"), ("30-120 mm", "±0.8 mm"), ("120-400 mm", "±1.2 mm"), ("400-1000 mm", "±2.0 mm")],
    "v": [("0.5-3 mm", "±0.5 mm"), ("3-6 mm", "±1.0 mm"), ("6-30 mm", "±1.5 mm"), ("30-120 mm", "±2.5 mm"), ("120-400 mm", "±4.0 mm"), ("400-1000 mm", "±6.0 mm")],
}


class CADAnalyzer:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        tesseract_cmd = os.getenv("TESSERACT_CMD", r"C:\Program Files\Tesseract-OCR\tesseract.exe")
        if pytesseract and tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    def analyze(self, file_path: str = None, file_bytes: bytes = None,
                filename: str = "drawing.jpg", tolerance_class: str = "m",
                validation_mode: str = "ISO", standard_doc_bytes: bytes = None,
                standard_doc_filename: str = None) -> Dict[str, Any]:
        if file_path:
            with open(file_path, "rb") as file:
                file_bytes = file.read()
            filename = Path(file_path).name

        if not file_bytes:
            return {"success": False, "error": "No file data received"}

        try:
            image, page_count = self._load_first_page(file_bytes, filename)
            if image is None:
                return {"success": False, "error": f"Could not decode drawing: {filename}"}

            ocr_items, ocr_warning = self._run_ocr(image)
            drawing_text = "\n".join(item["text"] for item in ocr_items)
            standard_text = ""
            if standard_doc_bytes and standard_doc_filename and validation_mode in ["Org", "Both"]:
                standard_text = self._extract_standard_text(standard_doc_bytes, standard_doc_filename)

            dimensions = self._extract_dimensions(ocr_items, tolerance_class, validation_mode, standard_text)
            standards = self._extract_standards(drawing_text, tolerance_class)
            notes = self._extract_notes(ocr_items)
            surface_finish = self._extract_surface_finish(ocr_items)
            gdts = self._extract_gdt_like_items(ocr_items)
            visual_markup = self._build_visual_markup(dimensions, ocr_items, validation_mode, drawing_text)
            quality_issues = self._build_quality_issues(visual_markup)

            analysis = {
                "success": True,
                "drawing_info": self._extract_drawing_info(ocr_items, filename, page_count),
                "standards_identified": standards,
                "dimensions_with_tolerances": dimensions,
                "generic_tolerances_applied": {
                    "standard": f"ISO 2768-{tolerance_class}",
                    "ranges": [{"range": r, "tolerance": t} for r, t in ISO_2768_RANGES.get(tolerance_class, ISO_2768_RANGES["m"])],
                },
                "gdts_identified": gdts,
                "drawing_notations": notes,
                "manufacturing_requirements": {
                    "special_processes": self._extract_process_notes(notes),
                    "quality_checks": [],
                    "surface_finish": surface_finish,
                },
                "gauge_requirements": self._build_gauge_requirements(dimensions),
                "conclusions": {
                    "summary": self._build_summary(dimensions, quality_issues, validation_mode, ocr_warning),
                    "critical_features_count": sum(1 for dim in dimensions if dim.get("is_critical")),
                    "special_processes_required": [item["process"] for item in self._extract_process_notes(notes)],
                    "quality_checkpoints": ["Manual review recommended for GD&T symbols and missing dimensions"],
                },
                "organizational_standard_violations": self._validate_org_standard(drawing_text, standard_text, validation_mode),
                "visual_markup": visual_markup,
                "quality_control_issues": quality_issues,
                "_metadata": {
                    "analysis_engine": "tesseract_ocr_opencv",
                    "source_file": filename,
                    "ocr_warning": ocr_warning,
                    "ocr_items": len(ocr_items),
                },
            }
            analysis["technical_report"] = self._build_technical_report(analysis, validation_mode)

            if visual_markup:
                img_b64 = self._draw_visual_markup(image, visual_markup)
                if img_b64:
                    analysis["processed_image_base64"] = f"data:image/jpeg;base64,{img_b64}"

            return analysis
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    def _load_first_page(self, file_bytes: bytes, filename: str) -> Tuple[Optional[np.ndarray], int]:
        suffix = Path(filename).suffix.lower()
        if suffix == ".pdf":
            import fitz
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            try:
                page = doc[0]
                pix = page.get_pixmap(matrix=fitz.Matrix(3, 3), alpha=False)
                arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
                return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR), len(doc)
            finally:
                doc.close()

        nparr = np.frombuffer(file_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return image, 1

    def _preprocess_for_ocr(self, image: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        gray = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
        return cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 11)

    def _run_ocr(self, image: np.ndarray) -> Tuple[List[Dict[str, Any]], str]:
        if not pytesseract:
            return [], "pytesseract is not installed; install it with pip and install the Tesseract OCR binary."

        processed = self._preprocess_for_ocr(image)
        try:
            data = pytesseract.image_to_data(
                processed,
                output_type=pytesseract.Output.DICT,
                config="--oem 3 --psm 11 -c preserve_interword_spaces=1",
            )
        except Exception as exc:
            return [], f"Tesseract OCR failed: {exc}"

        items = []
        height, width = image.shape[:2]
        for index, raw_text in enumerate(data.get("text", [])):
            text = str(raw_text).strip()
            if not text:
                continue
            try:
                confidence = float(data["conf"][index])
            except (ValueError, TypeError):
                confidence = -1
            if confidence >= 0 and confidence < 25:
                continue
            x, y, w, h = data["left"][index], data["top"][index], data["width"][index], data["height"][index]
            items.append({
                "text": text,
                "confidence": confidence,
                "box": (x, y, x + w, y + h),
                "box_2d": [int(y * 1000 / height), int(x * 1000 / width), int((y + h) * 1000 / height), int((x + w) * 1000 / width)],
                "line_num": data.get("line_num", [0])[index],
                "block_num": data.get("block_num", [0])[index],
            })
        return items, ""

    def _extract_dimensions(self, ocr_items: List[Dict[str, Any]], tolerance_class: str, validation_mode: str, standard_text: str) -> List[Dict[str, Any]]:
        dimensions = []
        seen = set()
        for item in ocr_items:
            text = self._normalize_ocr_text(item["text"])
            for match in DIMENSION_RE.finditer(text):
                value = match.group(0).strip()
                if len(value) < 2 or not any(char.isdigit() for char in value):
                    continue
                numeric = match.group("value").replace(",", ".")
                key = (value.upper(), tuple(item["box_2d"]))
                if key in seen:
                    continue
                seen.add(key)
                tolerance = match.group("tolerance").strip() or self._iso_tolerance_for(float(numeric), tolerance_class)
                explicit = bool(EXPLICIT_TOLERANCE_RE.search(match.group("tolerance") or ""))
                feature = self._feature_name(value, len(dimensions) + 1)
                dimensions.append({
                    "feature": feature,
                    "dimension": value,
                    "tolerance": tolerance,
                    "is_critical": explicit,
                    "requires_gauge": explicit,
                    "critical_reason": self._critical_reason(explicit, validation_mode),
                    "ocr_confidence": round(item.get("confidence", 0), 1),
                    "box_2d": item["box_2d"],
                })
        return dimensions

    def _normalize_ocr_text(self, text: str) -> str:
        return text.replace("O", "Ø") if re.match(r"^[Oo]\d", text) else text

    def _feature_name(self, value: str, number: int) -> str:
        upper = value.upper()
        if upper.startswith(("Ø", "⌀")):
            return f"Diameter {value}"
        if upper.startswith("R"):
            return f"Radius {value}"
        if "°" in upper or "DEG" in upper:
            return f"Angle {value}"
        return f"Dimension {number}"

    def _critical_reason(self, explicit: bool, validation_mode: str) -> str:
        source = "ISO / organizational" if validation_mode == "Both" else ("organizational" if validation_mode == "Org" else "ISO")
        if explicit:
            return f"{source.title()} review: explicit tolerance or fit detected; verify with inspection plan."
        return ""

    def _iso_tolerance_for(self, value: float, tolerance_class: str) -> str:
        ranges = ISO_2768_RANGES.get(tolerance_class, ISO_2768_RANGES["m"])
        limits = [(0.5, 3), (3, 6), (6, 30), (30, 120), (120, 400), (400, 1000)]
        for (_, high), (_, tolerance) in zip(limits, ranges):
            if value <= high:
                return tolerance
        return "Per drawing / verify manually"

    def _extract_drawing_info(self, ocr_items: List[Dict[str, Any]], filename: str, page_count: int) -> Dict[str, Any]:
        text = " ".join(item["text"] for item in ocr_items)
        lower = text.lower()
        return {
            "drawing_number": self._find_after_label(text, ["drawing no", "dwg no", "part no"]) or Path(filename).stem,
            "title": self._find_after_label(text, ["title", "description"]) or Path(filename).stem,
            "revision": self._find_after_label(text, ["rev", "revision"]) or "Unknown",
            "material": self._find_after_label(text, ["material", "matl"]) or ("Not specified" if "material" not in lower else "Unknown"),
            "scale": self._find_after_label(text, ["scale"]) or "Not specified",
            "date": (DATE_RE.search(text).group(0) if DATE_RE.search(text) else "Not specified"),
            "total_pages": page_count,
        }

    def _find_after_label(self, text: str, labels: List[str]) -> str:
        for label in labels:
            match = re.search(rf"{re.escape(label)}\s*[:#-]?\s*([A-Z0-9][A-Z0-9_. /\-]{{1,30}})", text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return ""

    def _extract_standards(self, text: str, tolerance_class: str) -> List[Dict[str, str]]:
        matches = sorted({match.group(0).strip(" .,-") for match in STANDARD_RE.finditer(text)})
        if not any("ISO 2768" in item.upper() for item in matches):
            matches.append(f"ISO 2768-{tolerance_class}")
        return [{"standard": item, "description": "Referenced or applied tolerance/engineering standard", "application": "Detected by OCR or selected tolerance class"} for item in matches]

    def _extract_notes(self, ocr_items: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        keywords = ("NOTE", "REMOVE", "DEBURR", "BREAK", "SHARP", "HEAT", "HARD", "COAT", "FINISH", "WELD", "BALANCE")
        notes = []
        for item in ocr_items:
            text = item["text"].strip()
            if len(text) > 3 and any(keyword in text.upper() for keyword in keywords):
                notes.append({"notation": text, "interpretation": "OCR-detected manufacturing or drawing note; verify wording manually."})
        return notes[:30]

    def _extract_surface_finish(self, ocr_items: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        finishes = []
        for item in ocr_items:
            match = SURFACE_RE.search(item["text"])
            if match:
                finishes.append({"surface": "Referenced surface", "ra_value": match.group(0), "process": "Verify from drawing note"})
        return finishes

    def _extract_gdt_like_items(self, ocr_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        gdts = []
        gdt_keywords = {"FLATNESS": "Flatness", "POSITION": "Position", "RUNOUT": "Runout", "PARALLEL": "Parallelism", "PERP": "Perpendicularity", "PROFILE": "Profile"}
        symbols = {"⌖": "Position", "⏥": "Flatness", "⏤": "Straightness", "⌓": "Profile", "⊥": "Perpendicularity", "∥": "Parallelism"}
        for item in ocr_items:
            upper = item["text"].upper()
            gdt_type = next((name for key, name in gdt_keywords.items() if key in upper), None)
            if not gdt_type:
                gdt_type = next((name for symbol, name in symbols.items() if symbol in item["text"]), None)
            if gdt_type:
                gdts.append({"feature": "OCR-detected GD&T callout", "symbol": "", "type": gdt_type, "value": item["text"], "datum": "Verify manually", "is_runout": gdt_type == "Runout", "is_critical": True})
        return gdts

    def _extract_process_notes(self, notes: List[Dict[str, str]]) -> List[Dict[str, str]]:
        processes = []
        for note in notes:
            text = note["notation"]
            if re.search(r"HEAT|HARD|COAT|WELD|BALANCE|ANOD", text, re.IGNORECASE):
                processes.append({"process": text[:40], "requirement": "Detected in drawing notes", "standard": "See drawing"})
        return processes

    def _build_gauge_requirements(self, dimensions: List[Dict[str, Any]]) -> Dict[str, Any]:
        gauge_dims = [dim["feature"] for dim in dimensions if dim.get("requires_gauge")]
        return {
            "requires_go_nogo": bool(gauge_dims),
            "dimensions_needing_gauges": gauge_dims,
            "measurement_instruments": ["Caliper", "Micrometer", "CMM or height gauge for positional checks"] if dimensions else [],
        }

    def _build_visual_markup(self, dimensions: List[Dict[str, Any]], ocr_items: List[Dict[str, Any]], validation_mode: str, drawing_text: str) -> List[Dict[str, Any]]:
        markup = []
        for dim in dimensions:
            if dim.get("is_critical"):
                markup.append({
                    "label": dim["feature"],
                    "box_2d": dim["box_2d"],
                    "status": "error",
                    "reason": f"{'ISO / Organizational' if validation_mode == 'Both' else validation_mode} Review: explicit tolerance requires QC verification.",
                })
        if "material" not in drawing_text.lower():
            title_block_box = self._estimate_title_block_box(ocr_items)
            if title_block_box:
                markup.append({
                    "label": "Material",
                    "box_2d": title_block_box,
                    "status": "error",
                    "reason": "ISO Violation: material field was not detected by OCR; verify title block completeness.",
                })
        return markup[:50]

    def _estimate_title_block_box(self, ocr_items: List[Dict[str, Any]]) -> Optional[List[int]]:
        bottom_items = [item for item in ocr_items if item["box_2d"][0] > 650 or item["box_2d"][1] > 650]
        if not bottom_items:
            return None
        ymin = min(item["box_2d"][0] for item in bottom_items)
        xmin = min(item["box_2d"][1] for item in bottom_items)
        ymax = max(item["box_2d"][2] for item in bottom_items)
        xmax = max(item["box_2d"][3] for item in bottom_items)
        return [ymin, xmin, ymax, xmax]

    def _build_quality_issues(self, visual_markup: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        return [{
            "issue_type": "Standard Violation" if "Violation" in item.get("reason", "") else "Manual Review",
            "description": item.get("reason", "OCR/OpenCV flagged this region for review."),
            "feature": item.get("label", "Unknown"),
            "severity": "High",
            "reason": item.get("reason", "Verify manually"),
        } for item in visual_markup if item.get("status") == "error"]

    def _validate_org_standard(self, drawing_text: str, standard_text: str, validation_mode: str) -> List[Dict[str, str]]:
        if validation_mode not in ["Org", "Both"] or not standard_text:
            return []
        violations = []
        for line in [line.strip() for line in standard_text.splitlines() if line.strip()]:
            if len(line) > 8 and line.lower().startswith(("must", "shall", "required")) and line[:40].lower() not in drawing_text.lower():
                violations.append({"feature": "Organizational standard", "violation": f"Requirement may be missing: {line[:120]}", "expected": line})
        return violations[:20]

    def _build_summary(self, dimensions: List[Dict[str, Any]], quality_issues: List[Dict[str, Any]], validation_mode: str, ocr_warning: str) -> str:
        warning = f" OCR warning: {ocr_warning}" if ocr_warning else ""
        return (
            f"Local Tesseract OCR + OpenCV extracted {len(dimensions)} dimension candidates and "
            f"flagged {len(quality_issues)} QC review item(s) using {validation_mode} mode."
            f"{warning} Validate critical items manually before release."
        )

    def _extract_standard_text(self, bytes_data: bytes, filename: str) -> str:
        if not bytes_data:
            return ""
        filename_lower = (filename or "").lower()
        if filename_lower.endswith(".pdf"):
            import fitz
            text = ""
            doc = fitz.open(stream=bytes_data, filetype="pdf")
            try:
                for page in doc:
                    text += page.get_text() + "\n"
            finally:
                doc.close()
            return text.strip()
        if filename_lower.endswith(".docx"):
            import io
            from docx import Document
            doc = Document(io.BytesIO(bytes_data))
            return "\n".join(para.text for para in doc.paragraphs)
        try:
            return bytes_data.decode("utf-8").strip()
        except Exception:
            return bytes_data.decode("latin-1", errors="ignore").strip()

    def _draw_visual_markup(self, image: np.ndarray, visual_markup: list) -> Optional[str]:
        if image is None or not visual_markup:
            return None
        out = image.copy()
        overlay = out.copy()
        height, width = out.shape[:2]

        for item in visual_markup:
            box = item.get("box_2d")
            if not box or len(box) != 4:
                continue
            ymin, xmin, ymax, xmax = box
            left, top = int(xmin * width / 1000), int(ymin * height / 1000)
            right, bottom = int(xmax * width / 1000), int(ymax * height / 1000)
            color = (0, 0, 255)
            cv2.rectangle(overlay, (left, top), (right, bottom), color, -1)
            cv2.rectangle(out, (left, top), (right, bottom), color, 3)
            label = str(item.get("label", ""))[:28].upper()
            if label:
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = max(0.4, min(0.7, width / 2600))
                thickness = max(1, int(width / 1800))
                (text_w, text_h), _ = cv2.getTextSize(label, font, font_scale, thickness)
                y1 = max(0, top - text_h - 8)
                y2 = y1 + text_h + 8
                cv2.rectangle(out, (left, y1), (left + text_w + 8, y2), color, -1)
                cv2.putText(out, label, (left + 4, y2 - 4), font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA)

        final_img = cv2.addWeighted(overlay, 0.25, out, 0.75, 0)
        _, buffer = cv2.imencode(".jpg", final_img, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
        return base64.b64encode(buffer).decode("utf-8")

    def _build_technical_report(self, analysis: Dict[str, Any], validation_mode: str) -> str:
        info = analysis.get("drawing_info") or {}
        dims = analysis.get("dimensions_with_tolerances") or []
        gdts = analysis.get("gdts_identified") or []
        notes = analysis.get("drawing_notations") or []
        issues = analysis.get("quality_control_issues") or []

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
            "2. OCR/OpenCV Analysis",
            f"Engine: {analysis.get('_metadata', {}).get('analysis_engine', 'tesseract_ocr_opencv')}",
            f"OCR Items Detected: {analysis.get('_metadata', {}).get('ocr_items', 0)}",
            f"Validation Mode: {validation_mode}",
            "",
            "3. Dimensions and Tolerances",
        ]
        if dims:
            for dim in dims:
                critical = "Critical" if dim.get("is_critical") else "Standard"
                lines.append(f"- {dim.get('feature')}: {dim.get('dimension')} | Tolerance: {dim.get('tolerance')} | {critical}")
        else:
            lines.append("- No dimension candidates extracted")

        lines.extend(["", "4. GD&T Review"])
        if gdts:
            for gdt in gdts:
                lines.append(f"- {gdt.get('type')}: {gdt.get('value')} | Datum: {gdt.get('datum')}")
        else:
            lines.append("- No GD&T keywords/symbols confidently identified by OCR")

        lines.extend(["", "5. Drawing Notes"])
        if notes:
            for note in notes:
                lines.append(f"- {note.get('notation')} -> {note.get('interpretation')}")
        else:
            lines.append("- No manufacturing notes confidently identified")

        lines.extend(["", "6. Quality Control (QC) Report"])
        if issues:
            for issue in issues:
                lines.append(f"- [{issue.get('severity')}] {issue.get('feature')}: {issue.get('description')}")
        else:
            lines.append("- No OCR/OpenCV QC issues flagged")

        lines.extend(["", "7. Conclusions", analysis.get("conclusions", {}).get("summary", "")])
        return "\n".join(lines)


def analyze_cad_drawing(file_path: str = None, file_bytes: bytes = None,
                        filename: str = "drawing", tolerance_class: str = "m",
                        api_key: str = None) -> Dict[str, Any]:
    analyzer = CADAnalyzer(api_key)
    return analyzer.analyze(file_path, file_bytes, filename, tolerance_class)