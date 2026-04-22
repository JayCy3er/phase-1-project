@echo off
title Studio3D - Voice Test
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] No .venv found. Run setup_windows.bat first.
    pause & exit /b 1
)

echo ===================================
echo   Studio3D - Running Voice Test
echo ===================================
echo.
echo Sending: "Hello from Studio3D. Voice generation is working."
echo Voice:   narrator  (engine: turbo)
echo.

"%~dp0.venv\Scripts\python.exe" scripts\test_voice.py

echo.
pause
