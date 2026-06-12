@echo off
echo Starting Food Connect...

start cmd /k "cd ml_service && uvicorn ml_service:app --port 8000 --reload"
start cmd /k "npm run dev"

echo Both servers started!