"""
CAD Drawing Comparator - Tesseract OCR + OpenCV Highlight Overlay.
Reports conservative engineering revisions only: added, removed, changed.
"""

import base64
from difflib import SequenceMatcher
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

try:
    import pytesseract
except ImportError:
    pytesseract = None

if pytesseract:
    pytesseract.pytesseract.tesseract_cmd = os.getenv(
        "TESSERACT_CMD",
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    )

# ── Regex ──────────────────────────────────────────────────────────────────────
DIMENSION_RE = re.compile(
    r"(?P<prefix>[Ø⌀RrMm]?\s*)"
    r"(?P<value>\d+(?:[.,]\d+)?)"
    r"(?P<unit>\s*(?:mm|cm|m|in|°|deg)?)"
    r"(?P<tolerance>\s*(?:±|\+/-|\+\s*\d+(?:[.,]\d+)?\s*/\s*-\s*\d+(?:[.,]\d+)?|[A-HJ-NP-Z][0-9]{1,2}|[a-hj-np-z][0-9]{1,2})?)"
)
TOLERANCE_RE = re.compile(r"(±|\+/-|\+\s*\d|-\s*\d|[A-HJ-NP-Z][0-9]{1,2}|[a-hj-np-z][0-9]{1,2})")

# BGR colours — slightly desaturated for a cleaner look on CAD drawings
COLOURS = {
    "added":     (45,  180,  90),   # green
    "removed":   (55,  120, 240),   # blue
    "changed":   (20,  160, 220),   # cyan-blue
    "deviation": (30,  110, 230),   # orange-red → using a strong blue-orange contrast
}
# Override with more distinct, readable colours
COLOURS = {
    "added":     (34,  197,  94),   # vivid green   (BGR)
    "removed":   (59,  130, 246),   # vivid blue    (BGR)
    "changed":   (234, 179,   8),   # amber         (BGR)
    "deviation": (249, 115,  22),   # orange        (BGR)
}

FILL_ALPHA   = 0.10   # lighter tint so CAD lines stay readable
MIN_BOX_SIZE = 24     # minimum rendered box dimension in pixels
LABEL_MAX_CHARS = 24
BADGE_RADIUS_RATIO = 1 / 90   # badge radius = min(w,h) / 90
MIN_BADGE_R = 12
MAX_BADGE_R = 20


# ── Image helpers ──────────────────────────────────────────────────────────────
def _decode_image(file_bytes: bytes) -> Optional[np.ndarray]:
    nparr = np.frombuffer(file_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)


def _decode_pdf_first_page(pdf_bytes: bytes) -> Optional[np.ndarray]:
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        try:
            page = doc[0]
            pix = page.get_pixmap(matrix=fitz.Matrix(3, 3), alpha=False)
            arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
            return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
        finally:
            doc.close()
    except Exception:
        return None


def _img_to_bgr(file_bytes: bytes, filename: str) -> Optional[np.ndarray]:
    if filename.lower().endswith(".pdf"):
        return _decode_pdf_first_page(file_bytes)
    return _decode_image(file_bytes)


def _img_to_b64(img: np.ndarray, quality: int = 92) -> str:
    _, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    return base64.b64encode(buf).decode("utf-8")


def _clip_pixel_box(left: int, top: int, right: int, bottom: int, width: int, height: int) -> Tuple[int, int, int, int]:
    left   = max(0, min(width  - 1, left))
    right  = max(0, min(width  - 1, right))
    top    = max(0, min(height - 1, top))
    bottom = max(0, min(height - 1, bottom))
    return left, top, right, bottom


def _norm_to_pixels(box: Dict[str, int], width: int, height: int, pad: int = 0) -> Tuple[int, int, int, int]:
    left   = int(box["xmin"] * width  / 1000) - pad
    top    = int(box["ymin"] * height / 1000) - pad
    right  = int(box["xmax"] * width  / 1000) + pad
    bottom = int(box["ymax"] * height / 1000) + pad
    return _clip_pixel_box(left, top, right, bottom, width, height)


def _pixels_to_norm(left: int, top: int, right: int, bottom: int, width: int, height: int) -> Dict[str, int]:
    return {
        "xmin": int(left   * 1000 / width),
        "ymin": int(top    * 1000 / height),
        "xmax": int(right  * 1000 / width),
        "ymax": int(bottom * 1000 / height),
    }


def _expand_norm_box(
    box: Dict[str, int],
    width: int,
    height: int,
    pad: int = 10,
    min_size: int = MIN_BOX_SIZE,
) -> Dict[str, int]:
    left, top, right, bottom = _norm_to_pixels(box, width, height, pad)
    # Enforce minimum pixel size
    if right - left < min_size:
        extra = (min_size - (right - left)) // 2 + 1
        left  -= extra
        right += extra
    if bottom - top < min_size:
        extra = (min_size - (bottom - top)) // 2 + 1
        top    -= extra
        bottom += extra
    left, top, right, bottom = _clip_pixel_box(left, top, right, bottom, width, height)
    return _pixels_to_norm(left, top, right, bottom, width, height)


def _box_iou(a: Dict[str, int], b: Dict[str, int]) -> float:
    inter_left   = max(a["xmin"], b["xmin"])
    inter_top    = max(a["ymin"], b["ymin"])
    inter_right  = min(a["xmax"], b["xmax"])
    inter_bottom = min(a["ymax"], b["ymax"])
    if inter_right <= inter_left or inter_bottom <= inter_top:
        return 0.0
    inter  = (inter_right - inter_left) * (inter_bottom - inter_top)
    area_a = max(1, (a["xmax"] - a["xmin"]) * (a["ymax"] - a["ymin"]))
    area_b = max(1, (b["xmax"] - b["xmin"]) * (b["ymax"] - b["ymin"]))
    return inter / (area_a + area_b - inter)


def _box_covered_by_any(box: Dict[str, int], boxes: List[Dict[str, int]], iou_threshold: float = 0.2) -> bool:
    return any(_box_iou(box, other) >= iou_threshold for other in boxes)


def _rects_intersect(a: Tuple[int, int, int, int], b: Tuple[int, int, int, int]) -> bool:
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


def _label_position(
    box: Tuple[int, int, int, int],
    label_size: Tuple[int, int],
    image_size: Tuple[int, int],
    occupied: List[Tuple[int, int, int, int]],
) -> Tuple[int, int, int, int]:
    left, top, right, bottom = box
    text_width, text_height  = label_size
    width, height            = image_size
    label_width  = min(width  - 1, text_width  + 18)
    label_height = text_height + 12

    # Prefer positions that don't overlap the annotated box
    candidates = [
        (left, top - label_height - 6),
        (left, bottom + 6),
        (right - label_width, top - label_height - 6),
        (right - label_width, bottom + 6),
        (left, top + 4),
    ]
    for x, y in candidates:
        x    = max(0, min(width  - label_width  - 1, x))
        y    = max(0, min(height - label_height - 1, y))
        rect = (x, y, x + label_width, y + label_height)
        if not any(_rects_intersect(rect, existing) for existing in occupied):
            return rect

    # Fallback: last candidate clamped
    x, y = candidates[-1]
    x    = max(0, min(width  - label_width  - 1, x))
    y    = max(0, min(height - label_height - 1, y))
    return (x, y, x + label_width, y + label_height)


def _preprocess_for_ocr(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
    return cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 11)


def _letterbox_resize(img: np.ndarray, width: int, height: int) -> np.ndarray:
    src_h, src_w = img.shape[:2]
    if src_w <= 0 or src_h <= 0:
        return np.full((height, width, 3), 255, dtype=np.uint8)

    scale = min(width / src_w, height / src_h)
    new_w = max(1, int(round(src_w * scale)))
    new_h = max(1, int(round(src_h * scale)))
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    canvas = np.full((height, width, 3), 255, dtype=np.uint8)
    x = (width - new_w) // 2
    y = (height - new_h) // 2
    canvas[y:y + new_h, x:x + new_w] = resized
    return canvas


def _alignment_gray(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(gray)


def _align_image(src: np.ndarray, dst: np.ndarray) -> np.ndarray:
    dst_h, dst_w = dst.shape[:2]
    fallback = _letterbox_resize(src, dst_w, dst_h)

    try:
        src_gray = _alignment_gray(src)
        dst_gray = _alignment_gray(dst)

        orb = cv2.ORB_create(nfeatures=2000)
        src_kp, src_desc = orb.detectAndCompute(src_gray, None)
        dst_kp, dst_desc = orb.detectAndCompute(dst_gray, None)

        if src_desc is None or dst_desc is None or len(src_kp) < 8 or len(dst_kp) < 8:
            return fallback

        matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
        pairs = matcher.knnMatch(src_desc, dst_desc, k=2)
        good = []
        for pair in pairs:
            if len(pair) != 2:
                continue
            best, second_best = pair
            if best.distance < 0.70 * second_best.distance:
                good.append(best)

        if len(good) < 8:
            return fallback

        src_pts = np.float32([src_kp[match.queryIdx].pt for match in good]).reshape(-1, 1, 2)
        dst_pts = np.float32([dst_kp[match.trainIdx].pt for match in good]).reshape(-1, 1, 2)
        homography, inliers = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)

        if homography is None or inliers is None or int(inliers.sum()) < 8:
            return fallback

        det = float(np.linalg.det(homography[:2, :2]))
        if not np.isfinite(det) or det <= 0.05 or det >= 20.0:
            return fallback

        return cv2.warpPerspective(
            src,
            homography,
            (dst_w, dst_h),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(255, 255, 255),
        )
    except cv2.error:
        return fallback


def _compute_pixel_similarity(img1: np.ndarray, img2: np.ndarray) -> Dict[str, Any]:
    h1, w1 = img1.shape[:2]
    img2_aligned = _align_image(img2, img1)

    g1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    g2 = cv2.cvtColor(img2_aligned, cv2.COLOR_BGR2GRAY)
    diff = cv2.absdiff(
        cv2.GaussianBlur(g1, (3, 3), 0),
        cv2.GaussianBlur(g2, (3, 3), 0),
    )
    _, thr = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
    changed_px = int(np.count_nonzero(thr))
    total_px = h1 * w1

    return {
        "pixel_similarity_percent": round((1 - changed_px / total_px) * 100, 2) if total_px else 100.0,
        "changed_pixels": changed_px,
        "total_pixels": total_px,
    }


# ── OCR: every token with bounding box ────────────────────────────────────────
def _ocr_all_items(img: np.ndarray) -> Tuple[List[Dict[str, Any]], str]:
    if not pytesseract:
        return [], "pytesseract not installed."
    try:
        data = pytesseract.image_to_data(
            _preprocess_for_ocr(img),
            output_type=pytesseract.Output.DICT,
            config="--oem 3 --psm 11 -c preserve_interword_spaces=1",
        )
    except Exception as exc:
        return [], f"Tesseract OCR failed: {exc}"

    height, width = img.shape[:2]
    items: List[Dict[str, Any]] = []

    for idx, raw_text in enumerate(data.get("text", [])):
        text = str(raw_text).strip()
        if not text:
            continue
        try:
            conf = float(data["conf"][idx])
        except (ValueError, TypeError):
            conf = -1
        if 0 <= conf < 20:
            continue

        text = text.replace("O", "Ø") if re.match(r"^[Oo]\d", text) else text
        x, y   = data["left"][idx], data["top"][idx]
        bw, bh = data["width"][idx], data["height"][idx]

        items.append({
            "text":          text,
            "key":           re.sub(r"\s+", "", text.upper()),
            "confidence":    conf,
            "norm": {
                "xmin": int(x          * 1000 / width),
                "ymin": int(y          * 1000 / height),
                "xmax": int((x + bw)   * 1000 / width),
                "ymax": int((y + bh)   * 1000 / height),
            },
            "is_dimension":  bool(DIMENSION_RE.search(text)),
            "has_tolerance": bool(TOLERANCE_RE.search(text)),
        })

    return items, ""


# ── Pixel-level diff regions ───────────────────────────────────────────────────
def _pixel_diff_regions(img1: np.ndarray, img2: np.ndarray) -> List[Dict[str, int]]:
    h2, w2 = img2.shape[:2]
    img1r  = _align_image(img1, img2)

    g1 = cv2.GaussianBlur(cv2.cvtColor(img1r, cv2.COLOR_BGR2GRAY), (3, 3), 0)
    g2 = cv2.GaussianBlur(cv2.cvtColor(img2,  cv2.COLOR_BGR2GRAY), (3, 3), 0)

    diff     = cv2.absdiff(g1, g2)
    _, mask_lo = cv2.threshold(diff, 20,  255, cv2.THRESH_BINARY)
    _, mask_hi = cv2.threshold(diff, 45,  255, cv2.THRESH_BINARY)
    mask = cv2.bitwise_and(mask_lo, mask_hi)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  np.ones((2, 2), np.uint8), iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8), iterations=1)
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=1)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    total    = h2 * w2
    min_area = max(60, total * 0.00004)
    max_area = total * 0.05

    boxes = []
    for cnt in contours:
        x, y, bw, bh = cv2.boundingRect(cnt)
        area = bw * bh
        if area < min_area or area > max_area:
            continue
        if bw > w2 * 0.75 or bh > h2 * 0.75:
            continue
        pad = 6
        x   = max(0, x - pad)
        y   = max(0, y - pad)
        bw  = min(w2 - x, bw + pad * 2)
        bh  = min(h2 - y, bh + pad * 2)
        boxes.append({
            "xmin": int(x        * 1000 / w2),
            "ymin": int(y        * 1000 / h2),
            "xmax": int((x + bw) * 1000 / w2),
            "ymax": int((y + bh) * 1000 / h2),
            "_area": area,
        })

    boxes.sort(key=lambda b: b["_area"], reverse=True)
    kept = []
    for box in boxes:
        norm_box = {k: v for k, v in box.items() if k != "_area"}
        if _box_covered_by_any(norm_box, kept, iou_threshold=0.35):
            continue
        kept.append(norm_box)
        if len(kept) >= 60:
            break
    return kept


def _nearest_box(norm_box: Optional[Dict], regions: List[Dict]) -> Optional[Dict]:
    if not regions:
        return norm_box
    if not norm_box:
        return regions[0] if regions else None
    cx = (norm_box["xmin"] + norm_box["xmax"]) / 2
    cy = (norm_box["ymin"] + norm_box["ymax"]) / 2
    return min(regions, key=lambda b:
               abs((b["xmin"] + b["xmax"]) / 2 - cx) +
               abs((b["ymin"] + b["ymax"]) / 2 - cy))


# ── Build comparison rows ──────────────────────────────────────────────────────
def _norm_center(box: Dict[str, int]) -> Tuple[float, float]:
    return ((box["xmin"] + box["xmax"]) / 2, (box["ymin"] + box["ymax"]) / 2)


def _norm_distance(a: Dict[str, int], b: Dict[str, int]) -> float:
    ax, ay = _norm_center(a)
    bx, by = _norm_center(b)
    return abs(ax - bx) + abs(ay - by)


OCR_EQUIV = str.maketrans({
    "O": "0",
    "o": "0",
    "I": "1",
    "l": "1",
    "S": "5",
    "s": "5",
    "B": "8",
    ",": ".",
})


def _semantic_text(text: str) -> str:
    value = str(text or "").upper().translate(OCR_EQUIV)
    value = value.replace("⌀", "Ø").replace(" ", "")
    value = re.sub(r"[^A-Z0-9Ø+\-/.°±()]", "", value)
    return value


def _numeric_signature(text: str) -> Tuple[str, Tuple[str, ...]]:
    semantic = _semantic_text(text)
    prefix = ""
    if "Ø" in semantic:
        prefix = "DIA"
    elif semantic.startswith("R"):
        prefix = "R"
    elif "°" in semantic or "DEG" in semantic:
        prefix = "ANGLE"
    elif "RZ" in semantic:
        prefix = "RZ"
    elif "RA" in semantic:
        prefix = "RA"
    numbers = tuple(re.findall(r"\d+(?:\.\d+)?", semantic))
    return prefix, numbers


def _is_engineering_item(item: Dict[str, Any]) -> bool:
    text = str(item.get("text", "")).strip()
    semantic = _semantic_text(text)
    if len(semantic) < 2:
        return False
    if float(item.get("confidence", 0) or 0) < 35:
        return False
    if re.fullmatch(r"[A-Z]", semantic):
        return False
    if re.fullmatch(r"\d", semantic):
        return False
    engineering_words = (
        "RZ", "RA", "FINISH", "SURFACE", "MATERIAL", "REV", "REVISION",
        "DATUM", "TOL", "TOLERANCE", "SCALE", "HARD", "SHARP", "THREAD",
    )
    return (
        bool(re.search(r"\d", semantic))
        or any(symbol in semantic for symbol in ("Ø", "°", "±"))
        or any(word in semantic for word in engineering_words)
    )


def _dedupe_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    kept: List[Dict[str, Any]] = []
    for item in sorted(items, key=lambda x: float(x.get("confidence", 0) or 0), reverse=True):
        if not _is_engineering_item(item):
            continue
        semantic = _semantic_text(item["text"])
        duplicate = False
        for existing in kept:
            same_text = semantic == _semantic_text(existing["text"])
            nearby = _norm_distance(item["norm"], existing["norm"]) < 20
            if same_text and nearby:
                duplicate = True
                break
        if not duplicate:
            kept.append(item)
    return kept


def _texts_equivalent(a: str, b: str) -> bool:
    semantic_a = _semantic_text(a)
    semantic_b = _semantic_text(b)
    if semantic_a == semantic_b:
        return True
    if not semantic_a or not semantic_b:
        return False
    return SequenceMatcher(None, semantic_a, semantic_b).ratio() >= 0.88


def _can_pair_as_changed(orig: Dict[str, Any], rev: Dict[str, Any]) -> bool:
    if _texts_equivalent(orig["text"], rev["text"]):
        return False
    if _norm_distance(orig["norm"], rev["norm"]) > 140:
        return False

    orig_prefix, orig_numbers = _numeric_signature(orig["text"])
    rev_prefix, rev_numbers = _numeric_signature(rev["text"])
    if not orig_numbers or not rev_numbers:
        return False
    if orig_prefix and rev_prefix and orig_prefix != rev_prefix:
        return False
    if len(orig_numbers) != len(rev_numbers):
        return False
    if orig_numbers == rev_numbers:
        return False
    return True


def _is_high_conf_unmatched(item: Dict[str, Any]) -> bool:
    semantic = _semantic_text(item["text"])
    conf = float(item.get("confidence", 0) or 0)
    if conf < 60:
        return False
    if len(re.findall(r"\d", semantic)) == 0:
        return False
    return len(semantic) >= 3


def _build_comparison_rows_legacy(
    img1: np.ndarray,
    img2: np.ndarray,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any], str]:

    orig_items, w1 = _ocr_all_items(img1)
    rev_items,  w2 = _ocr_all_items(img2)
    diff_regions   = _pixel_diff_regions(img1, img2)
    h2, w2_px      = img2.shape[:2]

    orig_by_key: Dict[str, list] = {}
    for item in orig_items:
        orig_by_key.setdefault(item["key"], []).append(item)

    rev_by_key: Dict[str, list] = {}
    for item in rev_items:
        rev_by_key.setdefault(item["key"], []).append(item)

    all_keys = set(orig_by_key) | set(rev_by_key)
    rows: List[Dict[str, Any]] = []

    for key in sorted(all_keys):
        orig_list = orig_by_key.get(key, [])
        rev_list  = rev_by_key.get(key,  [])
        orig = orig_list[0] if orig_list else None
        rev  = rev_list[0]  if rev_list  else None
        item = rev or orig

        if orig and rev:
            o_cx = (orig["norm"]["xmin"] + orig["norm"]["xmax"]) / 2
            o_cy = (orig["norm"]["ymin"] + orig["norm"]["ymax"]) / 2
            r_cx = (rev["norm"]["xmin"]  + rev["norm"]["xmax"])  / 2
            r_cy = (rev["norm"]["ymin"]  + rev["norm"]["ymax"])  / 2
            pos_delta = abs(o_cx - r_cx) + abs(o_cy - r_cy)

            if pos_delta > 60:
                status      = "changed"
                description = f"'{item['text']}' moved significantly between drawings."
                highlight   = _expand_norm_box(rev["norm"], w2_px, h2, pad=10)
            else:
                status      = "match"
                description = "No change"
                highlight   = None

        elif rev:
            status      = "added"
            description = f"'{rev['text']}' appears only in revised drawing."
            highlight   = _expand_norm_box(
                _nearest_box(rev["norm"], diff_regions) or rev["norm"], w2_px, h2, pad=10
            )

        else:
            status      = "removed"
            description = f"'{orig['text']}' exists only in original drawing."
            nearest     = _nearest_box(orig["norm"], diff_regions)
            highlight   = _expand_norm_box(nearest, w2_px, h2, pad=10) if nearest else None

        rows.append({
            "feature":            item["text"],
            "type":               "Dimension" if item["is_dimension"] else "Annotation",
            "original_value":     orig["text"] if orig else "N/A",
            "compared_value":     rev["text"]  if rev  else "N/A",
            "original_tolerance": "Yes" if orig and orig["has_tolerance"] else "—",
            "compared_tolerance": "Yes" if rev  and rev["has_tolerance"]  else "—",
            "status":             status,
            "change_description": description,
            "highlight_box":      highlight,
        })

    # Add pixel-diff regions not already covered by OCR boxes
    used_boxes = [r["highlight_box"] for r in rows if r.get("highlight_box")]
    for i, box in enumerate(diff_regions, 1):
        expanded_box = _expand_norm_box(box, w2_px, h2, pad=8)
        if not _box_covered_by_any(expanded_box, used_boxes, iou_threshold=0.12):
            rows.append({
                "feature":            f"Visual change {i}",
                "type":               "Visual",
                "original_value":     "Region differs",
                "compared_value":     "Region differs",
                "original_tolerance": "—",
                "compared_tolerance": "—",
                "status":             "deviation",
                "change_description": "Pixel-level difference detected (shape/line/geometry change).",
                "highlight_box":      expanded_box,
            })
            used_boxes.append(expanded_box)

    counts  = {s: sum(1 for r in rows if r["status"] == s)
               for s in ["match", "deviation", "added", "removed", "changed"]}
    total   = len(rows)
    summary = {
        "total_items":                total,
        "matches":                    counts["match"],
        "deviations":                 counts["deviation"],
        "added":                      counts["added"],
        "removed":                    counts["removed"],
        "changed":                    counts["changed"],
        "overall_similarity_percent": round(counts["match"] / total * 100, 2) if total else 100.0,
    }
    warning = "; ".join(w for w in [w1, w2] if w)
    return rows, summary, warning


# ── Draw highlights: per-box, colour-coded ────────────────────────────────────
def _build_comparison_rows(
    img1: np.ndarray,
    img2: np.ndarray,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any], str]:

    orig_items, w1 = _ocr_all_items(img1)
    rev_items, w2 = _ocr_all_items(img2)
    h2, w2_px = img2.shape[:2]

    orig_candidates = _dedupe_items(orig_items)
    rev_candidates = _dedupe_items(rev_items)
    rows: List[Dict[str, Any]] = []
    matched_orig = set()
    matched_rev = set()

    for oi, orig in enumerate(orig_candidates):
        best_idx = None
        best_score = -1.0
        for ri, rev in enumerate(rev_candidates):
            if ri in matched_rev:
                continue
            if not _texts_equivalent(orig["text"], rev["text"]):
                continue
            distance = _norm_distance(orig["norm"], rev["norm"])
            if distance > 220:
                continue
            score = SequenceMatcher(None, _semantic_text(orig["text"]), _semantic_text(rev["text"])).ratio()
            if score > best_score:
                best_idx = ri
                best_score = score
        if best_idx is not None:
            matched_orig.add(oi)
            matched_rev.add(best_idx)

    changed_pairs: List[Tuple[int, int, float]] = []
    for oi, orig in enumerate(orig_candidates):
        if oi in matched_orig:
            continue
        for ri, rev in enumerate(rev_candidates):
            if ri in matched_rev:
                continue
            if _can_pair_as_changed(orig, rev):
                changed_pairs.append((oi, ri, _norm_distance(orig["norm"], rev["norm"])))

    for oi, ri, _ in sorted(changed_pairs, key=lambda pair: pair[2]):
        if oi in matched_orig or ri in matched_rev:
            continue
        orig = orig_candidates[oi]
        rev = rev_candidates[ri]
        matched_orig.add(oi)
        matched_rev.add(ri)
        rows.append({
            "feature":            f"{orig['text']} → {rev['text']}",
            "type":               "Dimension" if orig["is_dimension"] or rev["is_dimension"] else "Annotation",
            "original_value":     orig["text"],
            "compared_value":     rev["text"],
            "original_tolerance": "Yes" if orig["has_tolerance"] else "—",
            "compared_tolerance": "Yes" if rev["has_tolerance"] else "—",
            "status":             "changed",
            "change_description": f"Engineering value changed from '{orig['text']}' to '{rev['text']}'.",
            "highlight_box":      _expand_norm_box(rev["norm"], w2_px, h2, pad=10),
        })

    for ri, rev in enumerate(rev_candidates):
        if ri in matched_rev or not _is_high_conf_unmatched(rev):
            continue
        if any(_texts_equivalent(rev["text"], orig["text"]) for orig in orig_candidates):
            continue
        rows.append({
            "feature":            rev["text"],
            "type":               "Dimension" if rev["is_dimension"] else "Annotation",
            "original_value":     "N/A",
            "compared_value":     rev["text"],
            "original_tolerance": "—",
            "compared_tolerance": "Yes" if rev["has_tolerance"] else "—",
            "status":             "added",
            "change_description": f"Engineering item '{rev['text']}' appears only in revised drawing.",
            "highlight_box":      _expand_norm_box(rev["norm"], w2_px, h2, pad=10),
        })

    for oi, orig in enumerate(orig_candidates):
        if oi in matched_orig or not _is_high_conf_unmatched(orig):
            continue
        if any(_texts_equivalent(orig["text"], rev["text"]) for rev in rev_candidates):
            continue
        nearest_rev = min(rev_candidates, key=lambda item: _norm_distance(orig["norm"], item["norm"]), default=None)
        if nearest_rev and _norm_distance(orig["norm"], nearest_rev["norm"]) < 80:
            continue
        rows.append({
            "feature":            orig["text"],
            "type":               "Dimension" if orig["is_dimension"] else "Annotation",
            "original_value":     orig["text"],
            "compared_value":     "N/A",
            "original_tolerance": "Yes" if orig["has_tolerance"] else "—",
            "compared_tolerance": "—",
            "status":             "removed",
            "change_description": f"Engineering item '{orig['text']}' exists only in original drawing.",
            "highlight_box":      _expand_norm_box(orig["norm"], w2_px, h2, pad=10),
        })

    filtered_rows = []
    seen_changes = set()
    for row in rows:
        key = (
            row["status"],
            _semantic_text(row.get("original_value")),
            _semantic_text(row.get("compared_value")),
        )
        if key in seen_changes:
            continue
        if row["status"] == "deviation" or str(row.get("feature", "")).lower().startswith("visual change"):
            continue
        seen_changes.add(key)
        filtered_rows.append(row)
    rows = filtered_rows

    if not rows:
        rows.append({
            "feature":            "No verified engineering changes",
            "type":               "Summary",
            "original_value":     "No verified change",
            "compared_value":     "No verified change",
            "original_tolerance": "—",
            "compared_tolerance": "—",
            "status":             "match",
            "change_description": "No high-confidence engineering revisions detected.",
            "highlight_box":      None,
        })

    counts = {status: sum(1 for row in rows if row["status"] == status)
              for status in ["match", "deviation", "added", "removed", "changed"]}
    total_changes = counts["added"] + counts["removed"] + counts["changed"]
    summary = {
        "total_items":                total_changes,
        "matches":                    counts["match"],
        "deviations":                 0,
        "added":                      counts["added"],
        "removed":                    counts["removed"],
        "changed":                    counts["changed"],
        "overall_similarity_percent": 100.0 if total_changes == 0 else round(max(0, 100 - total_changes * 5), 2),
    }
    warning = "; ".join(w for w in [w1, w2] if w)
    return rows, summary, warning


def _draw_highlights(img: np.ndarray, rows: List[Dict[str, Any]]) -> np.ndarray:
    if img is None or not rows:
        return img

    out           = img.copy()
    h, w          = out.shape[:2]
    short_side    = min(w, h)
    occupied_labels: List[Tuple[int, int, int, int]] = []
    visible_rows = [row for row in rows if row.get("status") != "match" and row.get("highlight_box")]

    # ── adaptive sizing ──────────────────────────────────────────────────────
    # Border thickness: 1px per 400px of short side, clamped 2–5
    border_thick  = max(2, min(5, round(short_side / 400)))
    # Font scale for labels: readable at any resolution
    font_scale    = max(0.40, min(0.65, short_side / 1800))
    font_thick    = max(1, round(short_side / 2000))
    font          = cv2.FONT_HERSHEY_SIMPLEX
    # Badge radius: ~1/80 of short side
    badge_r       = max(MIN_BADGE_R, min(MAX_BADGE_R, round(short_side * BADGE_RADIUS_RATIO)))

    for marker, row in enumerate(visible_rows, 1):
        status = row.get("status", "match")
        box    = row.get("highlight_box")
        colour = COLOURS.get(status, COLOURS["deviation"])
        left, top, right, bottom = _norm_to_pixels(box, w, h)
        if right <= left or bottom <= top:
            continue

        row["marker"] = marker

        # ── 1. Soft tint inside the box (ROI blend only — no global tint) ──
        roi    = out[top:bottom, left:right].copy()
        tinted = roi.copy()
        cv2.rectangle(tinted, (0, 0), (right - left, bottom - top), colour, -1)
        cv2.addWeighted(tinted, FILL_ALPHA, roi, 1 - FILL_ALPHA, 0, roi)
        out[top:bottom, left:right] = roi

        # ── 2. White halo so box is visible on dark and light CAD lines ───
        cv2.rectangle(out, (left, top), (right, bottom), (255, 255, 255), border_thick + 2)
        cv2.rectangle(out, (left, top), (right, bottom), colour,          border_thick)

        # ── 3. Corner ticks — length proportional to box size ─────────────
        tick = max(12, min(32, round(min(right - left, bottom - top) * 0.30)))
        for sx, sy in [(left, top), (right, top), (left, bottom), (right, bottom)]:
            xd = 1 if sx == left else -1
            yd = 1 if sy == top  else -1
            cv2.line(out, (sx, sy), (sx + xd * tick, sy), colour, border_thick + 1, cv2.LINE_AA)
            cv2.line(out, (sx, sy), (sx, sy + yd * tick), colour, border_thick + 1, cv2.LINE_AA)

        # ── 4. Number badge — crisp circle with white number ──────────────
        badge_x = max(badge_r + 3, min(w - badge_r - 3, left))
        badge_y = max(badge_r + 3, min(h - badge_r - 3, top))
        # White halo around badge so it floats off any background
        cv2.circle(out, (badge_x, badge_y), badge_r + 3, (255, 255, 255), -1, cv2.LINE_AA)
        cv2.circle(out, (badge_x, badge_y), badge_r,     colour,          -1, cv2.LINE_AA)

        badge_text  = str(marker)
        badge_scale = max(0.38, badge_r / 20.0)
        badge_thick = max(1, round(badge_r / 8))
        (mw, mh), _ = cv2.getTextSize(badge_text, font, badge_scale, badge_thick)
        cv2.putText(
            out, badge_text,
            (badge_x - mw // 2, badge_y + mh // 2),
            font, badge_scale, (255, 255, 255), badge_thick, cv2.LINE_AA,
        )

        # ── 5. Compact floating label ─────────────────────────────────────
        feature   = re.sub(r"\s+", " ", str(row.get("feature", ""))).strip()
        label     = f"{marker} {status.upper()}: {feature[:LABEL_MAX_CHARS].upper()}"
        (tw, th), _ = cv2.getTextSize(label, font, font_scale, font_thick)

        lx1, ly1, lx2, ly2 = _label_position(
            (left, top, right, bottom),
            (tw, th),
            (w, h),
            occupied_labels,
        )
        occupied_labels.append((lx1, ly1, lx2, ly2))

        # Label background: white fill + coloured border
        cv2.rectangle(out, (lx1, ly1), (lx2, ly2), (255, 255, 255), -1)
        cv2.rectangle(out, (lx1, ly1), (lx2, ly2), colour,          max(1, border_thick - 1))
        # Small left-edge colour stripe for quick status identification
        stripe_w = max(3, round((lx2 - lx1) * 0.04))
        cv2.rectangle(out, (lx1, ly1), (lx1 + stripe_w, ly2), colour, -1)
        # Text in dark grey for legibility on white
        cv2.putText(
            out, label,
            (lx1 + stripe_w + 6, ly2 - 5),
            font, font_scale, (30, 30, 30), font_thick, cv2.LINE_AA,
        )

    return out


# ── Pixel-diff overlay image ───────────────────────────────────────────────────
def _pixel_diff_image(img1: np.ndarray, img2: np.ndarray) -> np.ndarray:
    h1, w1  = img1.shape[:2]
    img2r   = _align_image(img2, img1)

    g1      = cv2.GaussianBlur(cv2.cvtColor(img1,  cv2.COLOR_BGR2GRAY), (3, 3), 0)
    g2      = cv2.GaussianBlur(cv2.cvtColor(img2r, cv2.COLOR_BGR2GRAY), (3, 3), 0)
    diff    = cv2.absdiff(g1, g2)
    _, thr  = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
    thr     = cv2.dilate(thr, np.ones((3, 3), np.uint8), iterations=2)

    overlay = (img1 * 0.35).astype(np.uint8)
    overlay[(g1 < g2) & (thr > 0)] = [0,   0, 220]
    overlay[(g2 < g1) & (thr > 0)] = [0, 200,  60]
    amb = (thr > 0) & ~(g1 < g2) & ~(g2 < g1)
    overlay[amb] = [0, 200, 255]
    return cv2.addWeighted(img1, 0.35, overlay, 0.65, 0)


# ── Public API ─────────────────────────────────────────────────────────────────
def compare_images(
    file_bytes_1: bytes,
    file_bytes_2: bytes,
    filename_1:   str = "original",
    filename_2:   str = "compared",
    api_key:      Optional[str] = None,
) -> Dict[str, Any]:

    img1 = _img_to_bgr(file_bytes_1, filename_1)
    img2 = _img_to_bgr(file_bytes_2, filename_2)

    if img1 is None:
        return {"success": False, "error": f"Could not decode original image: {filename_1}"}
    if img2 is None:
        return {"success": False, "error": f"Could not decode comparison image: {filename_2}"}

    h1, w1 = img1.shape[:2]

    comparison_rows, summary, ocr_warning = _build_comparison_rows(img1, img2)
    highlighted_img = _draw_highlights(img2.copy(), comparison_rows)
    for marker, row in enumerate(
        [r for r in comparison_rows if r.get("status") != "match" and r.get("highlight_box")], 1
    ):
        row["marker"] = marker

    pixel_diff_img = _pixel_diff_image(img1, img2)
    pixel_metrics = _compute_pixel_similarity(img1, img2)
    pixel_sim = pixel_metrics["pixel_similarity_percent"]

    similarity = summary.get("overall_similarity_percent", pixel_sim)

    return {
        "success":                  True,
        "highlighted_image_base64": "data:image/jpeg;base64," + _img_to_b64(highlighted_img, 92),
        "diff_image_base64":        "data:image/jpeg;base64," + _img_to_b64(pixel_diff_img,  88),
        "original_image_base64":    "data:image/jpeg;base64," + _img_to_b64(img1, 88),
        "comparison_rows":          comparison_rows,
        "summary":                  summary,
        "ocr_warning":              ocr_warning,
        "similarity_percent":       similarity,
        "pixel_similarity_percent": pixel_sim,
        "changed_pixels":           pixel_metrics["changed_pixels"],
        "total_pixels":             pixel_metrics["total_pixels"],
        "original_filename":        filename_1,
        "compared_filename":        filename_2,
        "original_size":            {"width": w1,            "height": h1},
        "compared_size":            {"width": img2.shape[1], "height": img2.shape[0]},
        "_metadata":                {"comparison_engine": "tesseract_ocr_opencv"},
    }
