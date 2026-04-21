@echo off
title Studio3D Setup — Windows Native
echo ============================================================
echo   Studio3D — Windows Setup (torch-directml + AMD GPU)
echo ============================================================
echo.
echo This script will:
echo   1. Create a Python virtual environment
echo   2. Install PyTorch 2.4.1  (required by torch-directml)
echo   3. Install torch-directml (DirectX 12 GPU backend for AMD/Intel/NVIDIA)
echo   4. Install chatterbox-tts without its conflicting torch pin
echo   5. Install all remaining dependencies
echo.
echo Estimated download: ~10 GB  (PyTorch + diffusers models download separately)
echo.
pause

:: ----------------------------------------------------------------
:: 0. Verify Python 3.10 / 3.11 / 3.12 is available
:: ----------------------------------------------------------------
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.11 from python.org and re-run.
    pause & exit /b 1
)

:: ----------------------------------------------------------------
:: 1. Create virtual environment
:: ----------------------------------------------------------------
echo.
echo [1/6] Creating virtual environment in .venv ...
if not exist ".venv" (
    python -m venv .venv
) else (
    echo        .venv already exists, skipping.
)
call .venv\Scripts\activate.bat

:: ----------------------------------------------------------------
:: 2. Upgrade pip
:: ----------------------------------------------------------------
echo.
echo [2/6] Upgrading pip ...
python -m pip install --upgrade pip setuptools wheel

:: ----------------------------------------------------------------
:: 3. Install PyTorch 2.4.1  (CPU wheel from PyPI — works with DirectML)
::    torch-directml replaces the GPU backend so the CPU wheel is correct.
:: ----------------------------------------------------------------
echo.
echo [3/6] Installing PyTorch 2.4.1 (CPU build — DirectML provides GPU) ...
pip install torch==2.4.1 torchaudio==2.4.1 torchvision==0.19.1 ^
    --index-url https://download.pytorch.org/whl/cpu

:: ----------------------------------------------------------------
:: 4. Install torch-directml (needs torch==2.4.1 — already satisfied)
:: ----------------------------------------------------------------
echo.
echo [4/6] Installing torch-directml ...
pip install torch-directml==0.2.5.dev240926

:: ----------------------------------------------------------------
:: 5. Install chatterbox-tts WITHOUT its torch pin
::    The pin (torch==2.6.0) is just a metadata constraint — the code
::    runs fine on 2.4.1.  We install --no-deps then add the real deps.
:: ----------------------------------------------------------------
echo.
echo [5/6] Installing chatterbox-tts (no-deps to skip conflicting torch pin) ...
pip install chatterbox-tts --no-deps
:: Now install chatterbox's actual runtime deps (excluding torch/torchaudio)
pip install resemble-perth huggingface_hub transformers accelerate soundfile conformer einops

:: ----------------------------------------------------------------
:: 6. Install remaining requirements
:: ----------------------------------------------------------------
echo.
echo [6/6] Installing remaining dependencies ...
pip install ^
    diffusers>=0.30.0 ^
    transformers>=4.40.0 ^
    accelerate>=0.30.0 ^
    huggingface_hub>=0.23.0 ^
    sentencepiece protobuf ^
    fastapi "uvicorn[standard]" "celery[redis]" redis python-multipart pydantic ^
    Pillow "numpy>=1.26.4,<2.0" "imageio[ffmpeg]" opencv-python httpx ^
    imageio

echo.
echo ============================================================
echo   Dependencies installed!
echo.
echo   Next steps:
echo     1. Install Redis for Windows:
echo        winget install Redis.Redis
echo        (or download from https://github.com/tporadowski/redis/releases)
echo.
echo     2. Install ffmpeg for Windows:
echo        winget install ffmpeg
echo.
echo     3. Download AI models:
echo        python scripts\download_models.py
echo.
echo     4. Start Studio3D:
echo        start.bat
echo ============================================================
pause
