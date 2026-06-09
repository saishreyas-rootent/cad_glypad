"""
CAD Drawing Comparator — Gemini Vision + OpenCV Highlight Overlay
Sends both drawings to Gemini for semantic diff, then uses OpenCV
to draw precise bounding-box highlights on the comparison image.
"""

import base64
import json
import os
import time
from typing import Any, Dict, List, Optional

import cv2
import numpy as np

try:
    import google.generativeai as genai
except ImportError:
    genai = None


# ── Image helpers ─────────────────────────────────────────────────────────────

def _decode_image(file_bytes: bytes) -> Optional[np.ndarray]:
    nparr = np.frombuffer(file_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)


def _decode_pdf_first_page(pdf_bytes: bytes) -> Optional[np.ndarray]:
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page = doc[0]
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
        img = cv2.cvtColor(arr, cv2.COLOR_RGBA2BGR if pix.n == 4 else cv2.COLOR_RGB2BGR)
        doc.close()
        return img
    except Exception:
        return None


def _img_to_bgr(file_bytes: bytes, filename: str) -> Optional[np.ndarray]:
    if filename.lower().endswith(".pdf"):
        return _decode_pdf_first_page(file_bytes)
    return _decode_image(file_bytes)


def _img_to_b64(img: np.ndarray, quality: int = 92) -> str:
    _, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    return base64.b64encode(buf).decode("utf-8")


def _bytes_to_b64(file_bytes: bytes, filename: str) -> tuple[str, str]:
    """Return (base64_string, mime_type) suitable for Gemini."""
    ext = filename.lower().rsplit(".", 1)[-1]
    if ext == "pdf":
        return base64.b64encode(file_bytes).decode("utf-8"), "application/pdf"
    if ext in ("jpg", "jpeg"):
        return base64.b64encode(file_bytes).decode("utf-8"), "image/jpeg"
    return base64.b64encode(file_bytes).decode("utf-8"), "image/png"


# ── Gemini comparison ─────────────────────────────────────────────────────────

_COMPARISON_PROMPT = """You are a senior metrology engineer performing a revision-control audit on two CAD/engineering drawings.

IMAGE 1 = ORIGINAL drawing.
IMAGE 2 = REVISED / COMPARISON drawing.

Your job:
1. Extract EVERY dimension, tolerance, GD&T callout, surface finish, title-block field, and annotation from BOTH drawings.
2. For each item, produce one row comparing the two drawings.
3. Identify items that:
   - Are IDENTICAL in both  → status: "match"
   - Have different values   → status: "deviation"
   - Exist only in original  → status: "removed"
   - Exist only in revised   → status: "added"

For EVERY deviation, added, or removed item you MUST provide a bounding box on the REVISED (Image 2) drawing
that tightly surrounds the changed region so it can be highlighted.
Use normalised coordinates 0-1000 (where 0,0 is top-left of the image).

Return ONLY valid JSON — no prose, no markdown fences — matching this exact schema:

{
  "summary": {
    "total_items": <int>,
    "matches": <int>,
    "deviations": <int>,
    "added": <int>,
    "removed": <int>,
    "overall_similarity_percent": <float 0-100>
  },
  "comparison_rows": [
    {
      "feature": "<human-readable feature name>",
      "type": "<Dimension | Tolerance | GD&T | Surface Finish | Title Block | Annotation>",
      "original_value": "<value or 'N/A'>",
      "compared_value": "<value or 'N/A'>",
      "original_tolerance": "<tolerance or '—'>",
      "compared_tolerance": "<tolerance or '—'>",
      "status": "<match | deviation | added | removed>",
      "change_description": "<one-sentence plain-English description of what changed, or 'No change'>",
      "highlight_box": {
        "ymin": <int 0-1000>,
        "xmin": <int 0-1000>,
        "ymax": <int 0-1000>,
        "xmax": <int 0-1000>
      }
    }
  ]
}

Rules:
- highlight_box MUST be present for every row where status != "match".
  For "match" rows set highlight_box to null.
- highlight_box coordinates refer to IMAGE 2 (the revised drawing).
- Be exhaustive — extract every visible dimension, GD&T frame, note, and title-block field.
- NEVER return null for feature, type, original_value, compared_value.
- Use '—' (em dash) when a tolerance is genuinely absent.
- Return ONLY the JSON object, starting with '{'.
"""


def _call_gemini(
    b64_1: str, mime_1: str,
    b64_2: str, mime_2: str,
    api_key: str,
    retries: int = 2,
) -> Dict[str, Any]:
    genai.configure(api_key=api_key)
    model_name = os.getenv('GEMINI_MODEL', 'gemini-3.1-flash-lite')
    model = genai.GenerativeModel(model_name)

    parts = [
        _COMPARISON_PROMPT,
        {"mime_type": mime_1, "data": b64_1},
        {"mime_type": mime_2, "data": b64_2},
    ]

    last_err = None
    for attempt in range(retries + 1):
        try:
            resp = model.generate_content(parts, request_options={"timeout": 120})
            if not resp or not resp.text:
                return {"error": "Gemini returned empty response"}
            return _parse_json(resp.text)
        except Exception as e:
            last_err = e
            if attempt < retries:
                time.sleep(2 ** attempt)

    return {"error": f"Gemini request failed: {last_err}"}


def _parse_json(text: str) -> Dict[str, Any]:
    # Strip markdown fences if present
    t = text.strip()
    if "```" in t:
        t = t.split("```")[1].split("```")[0]
        if t.startswith("json"):
            t = t[4:]
    try:
        return json.loads(t.strip(), strict=False)
    except Exception as e:
        return {"error": f"JSON parse error: {e}", "raw": text[:500]}


# ── OpenCV highlight overlay ──────────────────────────────────────────────────

# Colour palette keyed on status
_COLOURS = {
    "deviation": (0,  140, 255),   # orange
    "added":     (0,  200,  60),   # green
    "removed":   (0,   60, 220),   # blue  (shown on orig side; rarely used on comp)
}

_LABEL_BG = {
    "deviation": (0,  140, 255),
    "added":     (0,  200,  60),
    "removed":   (0,   60, 220),
}


def _draw_highlights(img: np.ndarray, rows: List[Dict]) -> np.ndarray:
    """
    Draw colour-coded bounding boxes + labels onto the comparison image.
    Returns a new image (copy).
    """
    if img is None or not rows:
        return img

    out = img.copy()
    h, w = out.shape[:2]

    # Semi-transparent fill layer
    overlay = out.copy()

    for row in rows:
        status = row.get("status", "match")
        if status == "match":
            continue

        box = row.get("highlight_box")
        if not box:
            continue

        colour = _COLOURS.get(status, (0, 140, 255))

        ymin = int(box.get("ymin", 0) * h / 1000)
        xmin = int(box.get("xmin", 0) * w / 1000)
        ymax = int(box.get("ymax", 0) * h / 1000)
        xmax = int(box.get("xmax", 0) * w / 1000)

        # Clamp
        ymin, ymax = max(0, ymin), min(h - 1, ymax)
        xmin, xmax = max(0, xmin), min(w - 1, xmax)

        if xmax <= xmin or ymax <= ymin:
            continue

        # Filled rect on overlay (alpha blend later)
        cv2.rectangle(overlay, (xmin, ymin), (xmax, ymax), colour, -1)
        # Solid border on out
        cv2.rectangle(out, (xmin, ymin), (xmax, ymax), colour, 3)

        # Label
        label = row.get("feature", "")[:28].upper()
        status_tag = status.upper()
        full_label = f"{status_tag}: {label}"

        font       = cv2.FONT_HERSHEY_SIMPLEX
        fscale     = max(0.38, min(0.55, w / 2800))
        thickness  = max(1, int(w / 2000))
        (tw, th), baseline = cv2.getTextSize(full_label, font, fscale, thickness)

        pad = 4
        lx1, ly1 = xmin, ymin - th - pad * 2
        lx2, ly2 = xmin + tw + pad * 2, ymin

        # Push below top if clipped
        if ly1 < 0:
            ly1 = ymin
            ly2 = ymin + th + pad * 2

        cv2.rectangle(out, (lx1, ly1), (lx2, ly2), colour, -1)
        cv2.putText(
            out, full_label,
            (lx1 + pad, ly2 - pad),
            font, fscale, (255, 255, 255), thickness, cv2.LINE_AA,
        )

    # Blend filled rects
    alpha = 0.22
    cv2.addWeighted(overlay, alpha, out, 1 - alpha, 0, out)
    return out


# ── Pixel-level diff (fallback / bonus panel) ─────────────────────────────────

def _pixel_diff(img1: np.ndarray, img2: np.ndarray) -> np.ndarray:
    h1, w1 = img1.shape[:2]
    img2r = cv2.resize(img2, (w1, h1), interpolation=cv2.INTER_AREA)

    g1 = cv2.GaussianBlur(cv2.cvtColor(img1,  cv2.COLOR_BGR2GRAY), (3, 3), 0)
    g2 = cv2.GaussianBlur(cv2.cvtColor(img2r, cv2.COLOR_BGR2GRAY), (3, 3), 0)

    diff  = cv2.absdiff(g1, g2)
    _, th = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
    th    = cv2.dilate(th, np.ones((3, 3), np.uint8), iterations=2)

    overlay = (img1 * 0.35).astype(np.uint8)
    overlay[((g1 < g2) & (th > 0))] = [0,   0, 220]   # red   → deletions
    overlay[((g2 < g1) & (th > 0))] = [0, 200,  60]   # green → additions
    both = (th > 0) & ~(g1 < g2) & ~(g2 < g1)
    overlay[both] = [0, 200, 255]                      # yellow → ambiguous

    return cv2.addWeighted(img1, 0.35, overlay, 0.65, 0)


# ── Public entry point ────────────────────────────────────────────────────────

def compare_images(
    file_bytes_1: bytes,
    file_bytes_2: bytes,
    filename_1: str = "original",
    filename_2: str = "compared",
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Full comparison pipeline:
      1. Decode both images (handles PDF rasterisation).
      2. Send both to Gemini Vision → structured JSON diff.
      3. Draw OpenCV highlight boxes on the comparison image for every change.
      4. Also produce a pixel-level diff image.
      5. Return everything the frontend needs.
    """

    # ── 1. Decode ──────────────────────────────────────────────────────────
    img1 = _img_to_bgr(file_bytes_1, filename_1)
    img2 = _img_to_bgr(file_bytes_2, filename_2)

    if img1 is None:
        return {"success": False, "error": f"Could not decode original image: {filename_1}"}
    if img2 is None:
        return {"success": False, "error": f"Could not decode comparison image: {filename_2}"}

    # Resize img2 to same dims as img1 for pixel diff (keep originals for Gemini)
    h1, w1 = img1.shape[:2]

    # ── 2. Gemini Vision diff ───────────────────────────────────────────────
    key = api_key or os.getenv("GEMINI_API_KEY")
    gemini_result: Dict[str, Any] = {}

    if key and genai:
        b64_1, mime_1 = _bytes_to_b64(file_bytes_1, filename_1)
        b64_2, mime_2 = _bytes_to_b64(file_bytes_2, filename_2)
        gemini_result = _call_gemini(b64_1, mime_1, b64_2, mime_2, key)
    else:
        gemini_result = {"error": "GEMINI_API_KEY not available"}

    comparison_rows: List[Dict] = gemini_result.get("comparison_rows", [])
    summary: Dict             = gemini_result.get("summary", {})
    gemini_error: str         = gemini_result.get("error", "")

    # ── 3. Draw highlights on comparison image ──────────────────────────────
    highlighted_img = _draw_highlights(img2.copy(), comparison_rows)

    # ── 4. Pixel diff ───────────────────────────────────────────────────────
    img2_resized = cv2.resize(img2, (w1, h1), interpolation=cv2.INTER_AREA)
    pixel_diff_img = _pixel_diff(img1, img2_resized)

    # ── 5. Encode outputs ───────────────────────────────────────────────────
    highlighted_b64  = "data:image/jpeg;base64," + _img_to_b64(highlighted_img, 92)
    pixel_diff_b64   = "data:image/jpeg;base64," + _img_to_b64(pixel_diff_img,  88)
    original_b64     = "data:image/jpeg;base64," + _img_to_b64(img1,            88)

    # ── 6. Compute pixel stats (always available as fallback) ───────────────
    g1  = cv2.cvtColor(img1,         cv2.COLOR_BGR2GRAY)
    g2r = cv2.cvtColor(img2_resized, cv2.COLOR_BGR2GRAY)
    g1b = cv2.GaussianBlur(g1,  (3, 3), 0)
    g2b = cv2.GaussianBlur(g2r, (3, 3), 0)
    diff_ = cv2.absdiff(g1b, g2b)
    _, th_ = cv2.threshold(diff_, 25, 255, cv2.THRESH_BINARY)
    changed_px = int(np.count_nonzero(th_))
    total_px   = h1 * w1
    pixel_sim  = round((1 - changed_px / total_px) * 100, 2)

    # Use Gemini's similarity if available, otherwise fall back to pixel
    similarity = summary.get("overall_similarity_percent", pixel_sim)

    return {
        "success": True,

        # Images
        "highlighted_image_base64": highlighted_b64,   # comp image WITH boxes drawn
        "diff_image_base64":        pixel_diff_b64,    # pixel-level diff overlay
        "original_image_base64":    original_b64,      # original re-encoded (for sync)

        # Gemini structured data
        "comparison_rows":          comparison_rows,
        "summary":                  summary,
        "gemini_error":             gemini_error,      # non-fatal; front-end can warn

        # Stats
        "similarity_percent":       similarity,
        "pixel_similarity_percent": pixel_sim,
        "changed_pixels":           changed_px,
        "total_pixels":             total_px,

        # Meta
        "original_filename":        filename_1,
        "compared_filename":        filename_2,
        "original_size":            {"width": w1,          "height": h1},
        "compared_size":            {"width": img2.shape[1], "height": img2.shape[0]},
    }