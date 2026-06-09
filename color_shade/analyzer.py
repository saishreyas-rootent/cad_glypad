import os
import cv2
import numpy as np
import json
import google.generativeai as genai
from PIL import Image
import fitz  # PyMuPDF

def process_file(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.pdf':
        doc = fitz.open(file_path)
        page = doc.load_page(0)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        img_path = file_path.replace('.pdf', '_page1.jpg')
        pix.save(img_path)
        doc.close()
        return img_path, True
    return file_path, False

def analyze_drawing(file_path, output_path):
    working_image, was_pdf = process_file(file_path)
    
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-3.1-flash-lite')
    
    # 3. Optimize for Speed: Downscale and Compress before AI call
    img_pil = Image.open(working_image)
    
    # Target width 1536px (plenty for text, fast to upload)
    target_w = 1536
    w_percent = (target_w / float(img_pil.size[0]))
    target_h = int((float(img_pil.size[1]) * float(w_percent)))
    img_optimized = img_pil.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    prompt = """
    Perform a Comprehensive Quality Audit of this CAED drawing.
    
    CATEGORY A: TITLE BLOCK (Title, Material, Weight, Date)
    - Ensure all fields are filled and units are correct.
    
    CATEGORY B: GEOMETRIC DIMENSIONING (PART AREA)
    1. MISSING DIMENSIONS: Identify geometric features (holes, slots, edges) that lack positional or size dimensions. 
    2. INCORRECT REFERENCE DIMS: Identify dimensions in brackets ( ) that are redundant, over-constraining, or mathematically inconsistent.
    
    For EVERY error found (Title Block or Geometry), return:
    - label: Field/Feature Name (e.g., 'Hole #1', 'Material', 'Ref Dim')
    - box_2d: [ymin, xmin, ymax, xmax] around the error.
    - status: 'error' or 'valid'
    - reason: Detailed explanation of the failure.
    
    Return JSON list.
    """
    
    try:
        response = model.generate_content([prompt, img_optimized])
        text = response.text
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        field_reports = json.loads(text.strip())
    except Exception as e:
        print(f"Analysis error: {e}")
        field_reports = []

    img_cv = cv2.imread(working_image)
    h, w, _ = img_cv.shape
    overlay = img_cv.copy()
    
    processed_items = []
    
    for item in field_reports:
        box = item.get('box_2d')
        status = item.get('status', 'error')
        if not box or len(box) != 4: continue
        
        ymin, xmin, ymax, xmax = box
        left, top = int(xmin * w / 1000), int(ymin * h / 1000)
        right, bottom = int(xmax * w / 1000), int(ymax * h / 1000)
        
        # Color coding: Green for valid, Red for error
        color = (0, 255, 0) if status == 'valid' else (0, 0, 255)
        
        cv2.rectangle(overlay, (left, top), (right, bottom), color, -1)
        cv2.rectangle(img_cv, (left, top), (right, bottom), color, 3)
        
        processed_items.append({
            "label": item.get('label'),
            "reason": item.get('reason'),
            "status": status,
            "coords": {"left": xmin/10, "top": ymin/10, "width": (xmax-xmin)/10, "height": (ymax-ymin)/10}
        })

    alpha = 0.4
    final_img = cv2.addWeighted(overlay, alpha, img_cv, 1 - alpha, 0)
    cv2.imwrite(output_path, final_img)
    
    return {
        "status": "valid" if all(i['status'] == 'valid' for i in processed_items) else "error",
        "items": processed_items,
        "processed_image": os.path.basename(working_image)
    }
