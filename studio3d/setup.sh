#!/bin/bash
set -e

echo "==================================="
echo "  Studio3D Setup Script"
echo "==================================="

# Check WSL2
if grep -q microsoft /proc/version 2>/dev/null; then
  echo "✅ Running in WSL2"
else
  echo "⚠️  Not in WSL2 — continuing anyway"
fi

# Create directories
mkdir -p models backend/outputs backend/voices/presets backend/voices/custom

# Copy .env if not present
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📋 Created .env from .env.example — please edit it and set HF_TOKEN"
fi

# Python venv
echo ""
echo "Setting up Python environment..."
python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate

pip install --upgrade pip --quiet

# Detect GPU vendor and install appropriate PyTorch
if command -v rocminfo &> /dev/null; then
  echo "✅ AMD GPU detected — installing ROCm PyTorch (this takes a few minutes)"
  pip install torch torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/rocm6.1 --quiet
elif command -v nvidia-smi &> /dev/null; then
  echo "✅ NVIDIA GPU detected — installing CUDA PyTorch"
  pip install torch torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/cu121 --quiet
else
  echo "⚠️  No GPU runtime detected — installing CPU-only PyTorch"
  pip install torch torchvision torchaudio --quiet
fi

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r backend/requirements.txt --quiet

# Read tier from .env
TIER=$(grep "^INSTALL_TIER=" .env 2>/dev/null | cut -d '=' -f2 | tr -d '[:space:]' || echo "full")
echo ""
echo "==================================="
echo "  Downloading Models (tier: $TIER)"
echo "  This will take a while…"
echo "==================================="

if [ -z "$HF_TOKEN" ]; then
  HF_TOKEN=$(grep "^HF_TOKEN=" .env 2>/dev/null | cut -d '=' -f2 | tr -d '[:space:]' || echo "")
fi

if [ -z "$HF_TOKEN" ] || [ "$HF_TOKEN" = "your_huggingface_token_here" ]; then
  echo "⚠️  HF_TOKEN not set. Set it in .env for gated models (FLUX.1 Dev requires it)."
  echo "    Get your token at: https://huggingface.co/settings/tokens"
fi

if [ "$TIER" = "full" ]; then
  echo "Downloading FLUX.1 Dev (~24GB)…"
  huggingface-cli download black-forest-labs/FLUX.1-dev \
    --local-dir ./models/flux \
    --token "${HF_TOKEN:-}"
elif [ "$TIER" = "lite" ]; then
  echo "Downloading SD 3.5 Medium (~5GB)…"
  huggingface-cli download stabilityai/stable-diffusion-3.5-medium \
    --local-dir ./models/sd35 \
    --token "${HF_TOKEN:-}"
fi

if [ "$TIER" != "cloud" ]; then
  echo "Downloading TRELLIS-2 (~8GB)…"
  huggingface-cli download microsoft/TRELLIS-image-large \
    --local-dir ./models/trellis \
    --token "${HF_TOKEN:-}"

  echo "Downloading LTX-Video 2B (~6GB)…"
  huggingface-cli download Lightricks/LTX-Video-0.9.7-distilled \
    --local-dir ./models/ltx \
    --token "${HF_TOKEN:-}"

  echo "Chatterbox TTS downloads automatically on first voice generation."
fi

echo ""
echo "==================================="
echo "  ✅ Setup Complete!"
echo "==================================="
echo ""
echo "Next steps:"
echo "  1. Edit .env and set HF_TOKEN if you haven't already"
echo "  2. Start services:  docker-compose up --build"
echo "  3. Open browser:    http://localhost:3000"
echo ""
echo "AMD GPU users — make sure these are in your .env:"
echo "  HSA_OVERRIDE_GFX_VERSION=11.0.0"
echo "  HIP_VISIBLE_DEVICES=0"
echo ""
echo "To run without Docker (dev mode):"
echo "  source .venv/bin/activate"
echo "  redis-server &"
echo "  cd backend && uvicorn main:app --reload &"
echo "  cd backend && celery -A tasks worker --loglevel=info &"
echo "  cd frontend && npm install && npm run dev"
