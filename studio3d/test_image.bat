@echo off
title Studio3D - Image Test
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] No .venv found. Run setup_windows.bat first.
    pause & exit /b 1
)

echo ===================================
echo   Studio3D - Running Image Test
echo ===================================
echo.
echo Prompt: "a futuristic city at sunset, golden light, cinematic"
echo Size:   1024x1024
echo GPU:    AMD RX 7900 XTX via DirectML
echo.
echo First run loads FLUX into VRAM - this can take a few minutes.
echo Subsequent runs will be faster.
echo.

"%~dp0.venv\Scripts\python.exe" scripts\test_image.py

echo.
pause
