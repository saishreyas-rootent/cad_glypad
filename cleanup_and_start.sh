#!/bin/bash
# Clean up existing ports and restart both frontend and backend

echo "Cleaning up existing processes..."
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

echo "Starting Backend API Server (Port 8000)..."
python3 -m uvicorn cad_analyzer.api.server:app --host 0.0.0.0 --port 8000 --reload &

echo "Starting Frontend Vite Server (Port 5173)..."
cd frontend
npm run dev &

echo "Both servers have been started."
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"

# Keep the script running to prevent background processes from exiting
wait
