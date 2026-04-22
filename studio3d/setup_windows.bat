@echo off
title Studio3D Setup — Windows Native
echo ============================================================
echo   Studio3D — Windows Setup (torch-directml + AMD GPU)
echo ============================================================
echo.

:: ----------------------------------------------------------------
:: 0. Verify Python is available
:: ----------------------------------------------------------------
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.11 from python.org and re-run.
    pause & exit /b 1
)

:: ----------------------------------------------------------------
:: 1. (Re)create virtual environment — always fresh to avoid broken paths
::    if a venv was copied/moved its internal paths become stale.
:: ----------------------------------------------------------------
echo [1/7] Creating virtual environment in .venv ...
if exist ".venv" (
    echo        Removing old .venv and recreating to fix any stale paths...
    rmdir /s /q .venv
)
python -m venv .venv
call .venv\Scripts\activate.bat

:: Verify we're in the venv
python -c "import sys; assert '.venv' in sys.prefix, 'venv not active!'"
if errorlevel 1 (
    echo [ERROR] Virtual environment failed to activate. Check Python installation.
    pause & exit /b 1
)
echo        .venv ready at %CD%\.venv

:: ----------------------------------------------------------------
:: 2. Upgrade pip inside the venv
:: ----------------------------------------------------------------
echo.
echo [2/7] Upgrading pip ...
python -m pip install --upgrade pip setuptools wheel

:: ----------------------------------------------------------------
:: 3. Install PyTorch 2.4.1 CPU build
::    (torch-directml provides GPU; the CPU wheel is the correct base)
:: ----------------------------------------------------------------
echo.
echo [3/7] Installing PyTorch 2.4.1 (CPU build — DirectML adds GPU support) ...
pip install torch==2.4.1 torchaudio==2.4.1 torchvision==0.19.1 ^
    --index-url https://download.pytorch.org/whl/cpu

:: ----------------------------------------------------------------
:: 4. Install torch-directml (latest version that supports torch 2.4.1)
:: ----------------------------------------------------------------
echo.
echo [4/7] Installing torch-directml ...
pip install torch-directml==0.2.5.dev240914

:: ----------------------------------------------------------------
:: 5. Install numpy<2 BEFORE chatterbox (chatterbox requires numpy<2)
:: ----------------------------------------------------------------
echo.
echo [5/7] Installing numpy (pinned ^<2.0 for chatterbox compatibility) ...
pip install "numpy>=1.26.4,<2.0"

:: ----------------------------------------------------------------
:: 6. Install chatterbox-tts and all its real deps
::    --no-deps skips the conflicting torch==2.6.0 / torchaudio==2.6.0 pins.
::    We then install every other chatterbox dep manually.
:: ----------------------------------------------------------------
echo.
echo [6/7] Installing chatterbox-tts and audio dependencies ...
pip install chatterbox-tts --no-deps

:: chatterbox runtime deps (excluding torch/torchaudio which we already have)
pip install ^
    "librosa==0.11.0" ^
    "omegaconf" ^
    "pyloudnorm" ^
    "pykakasi==2.3.0" ^
    "s3tokenizer" ^
    "spacy-pkuseg" ^
    "safetensors==0.5.3" ^
    "resemble-perth" ^
    "conformer" ^
    "einops" ^
    "soundfile" ^
    "gradio==6.8.0"

:: ----------------------------------------------------------------
:: 7. Install remaining pipeline dependencies
:: ----------------------------------------------------------------
echo.
echo [7/7] Installing remaining dependencies ...
pip install ^
    "diffusers==0.30.3" ^
    "transformers>=4.40.0" ^
    "accelerate>=0.30.0" ^
    "huggingface_hub>=0.23.0" ^
    "sentencepiece" ^
    "protobuf" ^
    "fastapi" ^
    "uvicorn[standard]" ^
    "celery[redis]" ^
    "redis" ^
    "python-multipart" ^
    "pydantic" ^
    "Pillow" ^
    "imageio[ffmpeg]" ^
    "httpx"

echo.
echo ============================================================
echo   Setup complete!
echo.
echo   Next steps:
echo     1. Install Redis for Windows (if not already done):
echo        winget install Redis.Redis
echo.
echo     2. Install ffmpeg (if not already done):
echo        winget install ffmpeg
echo.
echo     3. Download AI models:
echo        python scripts\download_models.py
echo.
echo     4. Launch Studio3D:
echo        start.bat
echo ============================================================
pause
