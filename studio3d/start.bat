@echo off
title Studio3D Launcher
echo ===================================
echo   Studio3D - Starting All Services
echo ===================================
echo.

:: Redis (no terminal needed — runs as daemon)
echo [1/4] Starting Redis...
wsl -u root service redis-server start
echo       Done.

:: Backend
echo [2/4] Starting Backend ^(uvicorn^)...
start "Studio3D - Backend" wsl bash -ic "cd ~/phase-1-project/studio3d/backend && source ../.venv/bin/activate && uvicorn main:app --port 8000"

:: Celery
echo [3/4] Starting Celery worker...
start "Studio3D - Celery" wsl bash -ic "cd ~/phase-1-project/studio3d/backend && source ../.venv/bin/activate && celery -A tasks worker --loglevel=info"

:: Frontend
echo [4/4] Starting Frontend ^(Next.js^)...
start "Studio3D - Frontend" wsl bash -ic "cd ~/phase-1-project/studio3d/frontend && npm run dev"

:: Open browser after services warm up
echo.
echo Waiting 12 seconds for services to start...
timeout /t 12 /nobreak > nul
start http://localhost:3000

echo.
echo ===================================
echo   All services running!
echo   Browser opening at localhost:3000
echo ===================================
pause
