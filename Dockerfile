# Multi-stage build to build frontend and package Python application
# Stage 1: Build React frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend packages and install
COPY frontend/package*.json ./
RUN npm install

# Copy frontend code and build
COPY frontend/ ./
RUN npm run build

# Stage 2: Create Python runtime and install system packages
FROM python:3.10-slim
WORKDIR /app

# Install system dependencies for Tesseract OCR and OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set Environment variables for Tesseract
ENV TESSERACT_CMD=/usr/bin/tesseract

# Copy backend requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application files
COPY cad_analyzer/ cad_analyzer/
COPY scripts/ scripts/

# Copy the built frontend static files from the first stage
COPY --from=frontend-builder /app/static ./static

# Expose the API server port
EXPOSE 8000

# Start FastAPI server
CMD ["uvicorn", "cad_analyzer.api.server:app", "--host", "0.0.0.0", "--port", "8000"]
