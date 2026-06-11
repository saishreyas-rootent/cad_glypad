"""
CAD Drawing Analyzer - REST API Server
Serves the React frontend in production and exposes the analysis API.
"""

import os
from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional

from cad_analyzer.core.comparator import compare_images

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from cad_analyzer.core import CADAnalyzer

app = FastAPI(
    title="CAD Drawing Analyzer API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
if _raw_origins:
    allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
else:
    allowed_origins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ── Response models ───────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str


# ── Analyzer singleton ────────────────────────────────────────────────────────
_analyzer = None

def get_analyzer():
    global _analyzer
    if _analyzer is None:
        _analyzer = CADAnalyzer()
    return _analyzer


# ── Static frontend ───────────────────────────────────────────────────────────
STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "static"))
ASSETS_DIR = os.path.join(STATIC_DIR, "assets")

if os.path.isdir(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
async def root():
    index = os.path.join(STATIC_DIR, "index.html")
    if os.path.isfile(index):
        return FileResponse(index)
    return {"message": "Backend running — no frontend build found"}


@app.get("/health", response_model=HealthResponse, tags=["Info"])
async def health_check():
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="2.0.0",
    )


@app.post("/analyze", tags=["Analysis"])
async def analyze_drawing(
    file: UploadFile = File(...),
    tolerance_class: str = Form("m"),
    validation_mode: str = Form("ISO"),
    standard_doc: Optional[UploadFile] = File(None),
):
    """
    Analyze a single CAD/engineering drawing (JPG, PNG, PDF, or TIFF).
    Tolerance class: f = Fine · m = Medium · c = Coarse · v = Very Coarse
    """
    if tolerance_class not in ["f", "m", "c", "v"]:
        raise HTTPException(status_code=400, detail=f"Invalid tolerance class: {tolerance_class}")

    allowed_types = ["image/jpeg", "image/png", "application/pdf", "image/jpg", "image/tiff", "image/x-tiff"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    standard_bytes = None
    standard_filename = None
    if standard_doc:
        standard_bytes = await standard_doc.read()
        standard_filename = standard_doc.filename

    try:
        result = get_analyzer().analyze(
            file_bytes=file_bytes,
            filename=file.filename or "drawing.jpg",
            tolerance_class=tolerance_class,
            validation_mode=validation_mode,
            standard_doc_bytes=standard_bytes,
            standard_doc_filename=standard_filename,
        )
        if isinstance(result, dict):
            result.setdefault("_metadata", {})
            result["_metadata"].setdefault("source_file", file.filename or "drawing.jpg")
        if isinstance(result, dict) and result.get("error"):
            raise HTTPException(status_code=502, detail=result["error"])
        return JSONResponse(content=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/compare", tags=["Comparison"])
async def compare_drawings(
    file1: UploadFile = File(...),
    file2: UploadFile = File(...),
):
    """
    Compare two CAD drawings.
    Uses Tesseract OCR for text/dimension extraction and OpenCV for visual diffing.

    Returns:
    - highlighted_image_base64 : revised image with coloured bounding boxes drawn on it
    - diff_image_base64        : pixel-level diff overlay (bonus visual)
    - comparison_rows          : structured table of every changed / added / removed item
    - summary                  : totals and overall similarity %
    """
    allowed_types = [
        "image/jpeg", "image/png", "application/pdf",
        "image/jpg", "image/tiff", "image/x-tiff",
    ]

    if file1.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported file type for original: {file1.content_type}")
    if file2.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported file type for comparison: {file2.content_type}")

    bytes1 = await file1.read()
    bytes2 = await file2.read()

    if not bytes1:
        raise HTTPException(status_code=400, detail="Original file is empty")
    if not bytes2:
        raise HTTPException(status_code=400, detail="Comparison file is empty")

    try:
        result = compare_images(
            file_bytes_1=bytes1,
            file_bytes_2=bytes2,
            filename_1=file1.filename or "original",
            filename_2=file2.filename or "compared",
        )
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Comparison failed"))
        return JSONResponse(content=result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")


@app.post("/analyze/batch", tags=["Analysis"])
async def analyze_batch(
    files: list[UploadFile] = File(...),
    tolerance_class: str = Form(default="m"),
    validation_mode: str = Form(default="ISO"),
    standard_doc: Optional[UploadFile] = File(None),
):
    """Analyze up to 10 CAD drawings in a single request."""
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 files per batch")

    standard_bytes = None
    standard_filename = None
    if standard_doc:
        standard_bytes = await standard_doc.read()
        standard_filename = standard_doc.filename

    analyzer = get_analyzer()
    results = []
    for f in files:
        try:
            file_bytes = await f.read()
            result = analyzer.analyze(
                file_bytes=file_bytes,
                filename=f.filename or "drawing.jpg",
                tolerance_class=tolerance_class,
                validation_mode=validation_mode,
                standard_doc_bytes=standard_bytes,
                standard_doc_filename=standard_filename,
            )
            if isinstance(result, dict):
                result.setdefault("_metadata", {})
                result["_metadata"].setdefault("source_file", f.filename or "drawing.jpg")
            results.append(result)
        except Exception as e:
            results.append({
                "success": False,
                "error": str(e),
                "_metadata": {"source_file": f.filename or "drawing.jpg"},
            })

    return JSONResponse(content={"results": results, "total": len(results)})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
