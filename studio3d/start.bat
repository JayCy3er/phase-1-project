@echo off
title Studio3D Launcher
echo ===================================
echo   Studio3D - Starting All Services
echo ===================================
echo.

:: Activate venv
call .venv\Scripts\activate.bat 2>nul
if errorlevel 1 (
    echo [ERROR] Virtual environment not found.
    echo         Run setup_windows.bat first.
    pause & exit /b 1
)

:: [1/4] Redis
echo [1/4] Starting Redis...
where redis-server >nul 2>&1
if not errorlevel 1 (
    start /B redis-server
    echo       Redis started.
) else (
    :: Try the tporadowski Windows build location
    if exist "C:\Program Files\Redis\redis-server.exe" (
        start /B "C:\Program Files\Redis\redis-server.exe"
        echo       Redis started from Program Files.
    ) else (
        echo [WARN] redis-server not found in PATH.
        echo        Install with: winget install Redis.Redis
        echo        Continuing anyway — if Redis is already running as a service this is fine.
    )
)

:: [2/4] Backend (FastAPI / uvicorn)
echo [2/4] Starting Backend (uvicorn)...
start "Studio3D - Backend" cmd /k "cd /d %~dp0backend && call %~dp0.venv\Scripts\activate.bat && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: [3/4] Celery worker
echo [3/4] Starting Celery worker...
start "Studio3D - Celery" cmd /k "cd /d %~dp0backend && call %~dp0.venv\Scripts\activate.bat && celery -A tasks worker --loglevel=info --concurrency=1 --pool=solo"

:: [4/4] Frontend (Next.js)
echo [4/4] Starting Frontend (Next.js)...
start "Studio3D - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

:: Wait then open browser
echo.
echo Waiting 15 seconds for services to start...
timeout /t 15 /nobreak > nul
start http://localhost:3000

echo.
echo ===================================
echo   All services running!
echo   Browser opening at localhost:3000
echo ===================================
pause
