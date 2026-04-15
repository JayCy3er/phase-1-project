FROM python:3.11-slim

WORKDIR /app

# System deps (ffmpeg for merge step)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# PyTorch (ROCm) must be installed before other deps
# Override in docker-compose for NVIDIA/CPU builds
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/rocm6.1
RUN pip install --no-cache-dir torch torchvision torchaudio \
        --index-url ${TORCH_INDEX_URL}

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV HSA_OVERRIDE_GFX_VERSION=11.0.0
ENV PYTHONUNBUFFERED=1

EXPOSE 8000
