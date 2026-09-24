@echo off
REM Developer mode: backend with auto-reload on :8000 + Vite dev server on :5173 (proxies /api to :8000)
cd /d "%~dp0"
start "backend" cmd /k "cd backend && ..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
cd frontend && npm run dev
