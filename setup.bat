@echo off
REM IGNITE-AI - one-time local setup (Windows). Runs entirely on this PC.
setlocal
cd /d "%~dp0"

echo [1/4] Creating Python virtual environment (.venv) ...
if not exist ".venv\Scripts\python.exe" (
  py -3.11 -m venv .venv 2>nul || python -m venv .venv
)
if not exist ".venv\Scripts\python.exe" ( echo ERROR: could not create .venv - is Python 3.11 installed? & exit /b 1 )

echo [2/4] Installing Python packages ...
".venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
".venv\Scripts\python.exe" -m pip install -r backend\requirements.txt || exit /b 1

echo [3/4] Training + cross-validating the model (writes backend\data\artifacts) ...
pushd backend
"..\.venv\Scripts\python.exe" -m src.compute.model || (popd & exit /b 1)
"..\.venv\Scripts\python.exe" -m tests.test_core || (popd & exit /b 1)
popd

echo [4/4] Installing frontend packages and building the site ...
pushd frontend
call npm install --no-fund --no-audit || (popd & exit /b 1)
call npm run build || (popd & exit /b 1)
popd

echo.
echo Setup complete. Run start.bat to launch http://localhost:8000 (landing) and http://localhost:8000/demo (tool)
endlocal
