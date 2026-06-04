#!/bin/bash
# Run the CAD Analyzer API Server

cd "$(dirname "$0")"

# Check for .env
if [ ! -f .env ]; then
    echo "Error: .env file not found. Create it with GEMINI_API_KEY=your_key"
    exit 1
fi

# Install dependencies if needed
pip3 install -q fastapi uvicorn python-multipart google-generativeai python-dotenv

# Run server
echo "Starting CAD Analyzer API..."
echo "Docs available at: http://localhost:8000/docs"
echo ""
python3 -m uvicorn cad_analyzer.api.server:app --host 0.0.0.0 --port 8000 --reload
