@echo off
title Studio3D
cd /d "%~dp0"

echo ===================================
echo   Studio3D - Starting Services
echo ===================================
echo.

:: Verify venv exists
if not exist ".venv\Scripts\activate.bat" (
    echo [ERROR] No .venv found. Run setup_windows.bat first.
    pause & exit /b 1
)

:: --- Redis ---
echo [1/3] Starting Redis...
where redis-server >nul 2>&1
if not errorlevel 1 (
    start /B redis-server
) else if exist "C:\Program Files\Redis\redis-server.exe" (
    start /B "C:\Program Files\Redis\redis-server.exe"
) else (
    echo [WARN] redis-server not found - continuing (may already be running as a service)
)
timeout /t 2 /nobreak >nul

:: --- Backend (uvicorn) ---
echo [2/3] Starting Backend...
start "Studio3D Backend" cmd /k ^
  "cd /d "%~dp0backend" && "%~dp0.venv\Scripts\python.exe" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: --- Celery worker ---
echo [3/3] Starting Celery worker...
start "Studio3D Celery" cmd /k ^
  "cd /d "%~dp0backend" && "%~dp0.venv\Scripts\celery.exe" -A tasks worker --loglevel=info --concurrency=1 --pool=solo"

echo.
echo Waiting 10 seconds for services to start...
timeout /t 10 /nobreak >nul

echo.
echo ===================================
echo   Services running!
echo.
echo   Test voice:   test.bat
echo   Open UI:      http://localhost:3000  (after npm run dev in frontend)
echo ===================================
echo.
pause
