# Studio3D

A fully self-hosted, local AI creative pipeline. Generate images, 3D models, videos, and voice — all running on your own GPU. No subscriptions. No cloud fees. Full privacy.

```
[Prompt] → [FLUX Image Gen] → [TRELLIS 3D] → [Output GLB]
                    │
                    └→ [LTX Video] → [Merge] → [Final MP4]
                                        ↑
               [Prompt] → [Chatterbox Voice] ─┘
```

---

## What is Studio3D?

Studio3D is a **node-based AI creative pipeline** built as a web app (Next.js + React Flow canvas) backed by a FastAPI + Celery task queue. You wire up nodes on a canvas, hit Run, and the pipeline executes your 5-stage creative workflow:

| Stage | Model | Default | Size |
|---|---|---|---|
| Image generation | FLUX.1 Dev (Full) / SD 3.5 Medium (Lite) | 1024×1024 PNG | 24GB / 5GB |
| 3D model generation | TRELLIS-2 | GLB | 8GB |
| Video generation | LTX-Video 2B distilled | MP4 | 6GB |
| Voice synthesis | Chatterbox TTS | WAV | 2GB |
| Final mux | FFmpeg | MP4 | — |

---

## System Requirements

| Component | Minimum | Recommended |
|---|---|---|
| GPU VRAM | 8GB | 16GB+ |
| RAM | 16GB | 32–64GB |
| Disk | 30GB free | 60GB+ free |
| OS | Linux / WSL2 / macOS | Windows 11 + WSL2 Ubuntu 22.04 |
| Python | 3.10+ | 3.11 |

### GPU Compatibility

| GPU | Tier | Notes |
|---|---|---|
| AMD RX 7900 XTX (24GB) | Full | ROCm 6.1+ required |
| AMD RX 7900 XT (20GB) | Full | ROCm 6.1+ required |
| AMD RX 7800 XT (16GB) | Full | ROCm 6.1+ required |
| AMD RX 7700 XT (12GB) | Lite | ROCm 6.1+ required |
| AMD RX 6800 XT (16GB) | Full | ROCm 6.1, HSA_OVERRIDE needed |
| NVIDIA RTX 4090 (24GB) | Full | CUDA 12.1+ |
| NVIDIA RTX 4080 (16GB) | Full | CUDA 12.1+ |
| NVIDIA RTX 3080 (10GB) | Lite | CUDA 12.1+ |
| Apple M2/M3 Max/Ultra | Full | MPS backend, no ROCm |
| Apple M1/M2 (16GB+) | Lite | MPS backend |

---

## Quick Start (Docker)

```bash
git clone https://github.com/yourusername/studio3d
cd studio3d

# Copy and configure environment
cp .env.example .env
# Edit .env: set HF_TOKEN, adjust INSTALL_TIER

# Run setup (detects GPU, downloads models)
chmod +x setup.sh && ./setup.sh

# Start all services
docker-compose up --build

# Open in browser
open http://localhost:3000
```

---

## AMD RX 7900 XTX Specific Setup

### 1. Install ROCm 6.1.3

Follow AMD's official guide: https://rocm.docs.amd.com/en/latest/deploy/linux/installer/install.html

```bash
# Quick install (Ubuntu 22.04)
wget https://repo.radeon.com/amdgpu-install/6.1.3/ubuntu/jammy/amdgpu-install_6.1.60103-1_all.deb
sudo dpkg -i amdgpu-install_6.1.60103-1_all.deb
sudo amdgpu-install --usecase=rocm,hip
sudo usermod -aG render,video $USER
reboot
```

Verify: `rocminfo | grep gfx`  → should show `gfx1100`

### 2. WSL2 Configuration

Create or edit `C:\Users\<you>\.wslconfig`:

```ini
[wsl2]
memory=48GB
processors=24
gpuSupport=true
```

Then: `wsl --shutdown` and restart WSL2.

### 3. Required Environment Variables

These must be in your `.env` (already set in `.env.example`):

```bash
HSA_OVERRIDE_GFX_VERSION=11.0.0   # Critical for RX 7900 XTX
HIP_VISIBLE_DEVICES=0
ROCR_VISIBLE_DEVICES=0
```

Without `HSA_OVERRIDE_GFX_VERSION=11.0.0`, PyTorch ROCm will fail to detect the GPU.

### 4. Driver Versions That Work

- Windows driver: **AMD Adrenalin 24.12.x** or later
- HIP SDK: **6.2.4** (bundled with ROCm 6.1.3)
- WSL2 ROCm passthrough requires Windows 11 22H2+

### 5. ROCm Version Pinning Warning

Do not upgrade ROCm without testing first. ROCm 6.2+ changed some API paths. If you upgrade and models fail to load, pin back with:
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/rocm6.1
```

---

## NVIDIA Setup

Much simpler than AMD:

```bash
# Verify CUDA
nvidia-smi

# PyTorch with CUDA 12.1 (auto-selected by setup.sh)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

No special environment variables needed.

---

## Apple Silicon Setup

Studio3D uses PyTorch's MPS backend on Apple Silicon:

```bash
# Standard PyTorch for macOS (auto-selected by setup.sh)
pip install torch torchvision torchaudio
```

- MPS acceleration is automatic — no CUDA or ROCm needed
- M2 Pro/Max/Ultra recommended for Full tier (needs 16GB+ unified memory)
- Note: `model-viewer` web component requires Safari 15+ or Chrome

---

## Using the Node Canvas

1. **Add nodes** — Drag from the left toolbar onto the canvas
2. **Connect nodes** — Drag from an output handle (right of node) to an input handle (left)
3. **Configure** — Click a node to see its settings
4. **Run** — Click **▶ Run Workflow** in the top bar
5. **Download** — Each node shows a download button after completion

### Node Colors

| Color | Node |
|---|---|
| Blue | Prompt |
| Gray | Image Upload |
| Purple | FLUX Image Gen |
| Orange | TRELLIS 3D |
| Green | LTX Video |
| Pink | Chatterbox Voice |
| Yellow | FFmpeg Merge |
| Teal | Output |

### Keyboard Shortcuts

- `Delete` — Remove selected node/edge
- `Ctrl+Z` — Undo (React Flow built-in)
- `Scroll` — Zoom
- `Space+Drag` — Pan canvas

---

## Voice Library

### Adding Custom Voices

1. Click any Chatterbox Voice node
2. Open the Voice Library panel
3. Click **+ Add Voice**
4. Upload a 5–30 second WAV/MP3 of the speaker
5. Name it and select it

### Sourcing Reference Audio

For best quality, use 10-second clips of clear, noise-free speech:

- **VCTK Corpus** — https://datashare.ed.ac.uk/handle/10283/2950 (public domain, 109 speakers)
- **LibriVox** — https://librivox.org (public domain audiobooks)
- **Common Voice** — https://commonvoice.mozilla.org/datasets (CC0)

The bundled preset voices are 1-second silence placeholders. Replace them with real reference clips from the above sources.

---

## Install Tiers

| | Full | Lite | Cloud |
|---|---|---|---|
| Image model | FLUX.1 Dev (best quality) | SD 3.5 Medium | fal.ai API |
| 3D model | TRELLIS-2 (local) | TRELLIS-2 (local) | 3D AI Studio API |
| Video model | LTX-Video 2B (local) | LTX-Video 2B (local) | fal.ai API |
| Voice model | Chatterbox (local) | Chatterbox (local) | Chatterbox (local) |
| Download size | ~45GB | ~25GB | ~2GB |
| Min VRAM | 16GB | 8GB | Any |
| Min disk | 60GB | 30GB | 5GB |
| Cost per run | $0 | $0 | ~$0.25–$0.75 |

---

## Model Updates

Studio3D uses a manifest-based update system. When you want to push a model update to users:

### 1. Download the new model

```bash
huggingface-cli download new-org/new-model --local-dir ./models/image_gen
```

### 2. Generate the manifest

```bash
python scripts/generate-manifest.py
```

This computes SHA256 hashes and prompts you to bump versions.

### 3. Upload the manifest

```bash
rsync studio3d-models.json user@yourserver:/var/www/html/studio3d-models.json
```

Users will see an update notification in the Launcher the next time they check (auto-checks every 24 hours).

---

## Building the Desktop Installer

### Prerequisites

- Rust (https://rustup.rs)
- Node.js 20+
- Tauri CLI: `cargo install tauri-cli --version "^2.0"`

### Build for each platform

```bash
cd installer

# Install JS deps
npm install

# Development (with hot reload)
cargo tauri dev

# Production build
cargo tauri build
```

Outputs:
- Windows: `src-tauri/target/release/bundle/msi/*.msi`
- macOS: `src-tauri/target/release/bundle/dmg/*.dmg`
- Linux: `src-tauri/target/release/bundle/appimage/*.AppImage`

---

## Distributing to Friends

### Option 1: GitHub Releases

1. Build the installer for your platform
2. Create a GitHub release and upload the installer binary
3. Update `studio3d-models.json` with the download URLs
4. Share the GitHub release link

### Option 2: Cloudflare Tunnel (Home Hosting)

Expose your local Studio3D to the internet without port forwarding:

```bash
# Install cloudflared
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Create tunnel (one-time setup)
cloudflared tunnel login
cloudflared tunnel create studio3d
cloudflared tunnel route dns studio3d studio3d.yourdomain.com

# Start the tunnel (add to systemd for permanent)
cloudflared tunnel run --url http://localhost:3000 studio3d
```

Friends can then access your Studio3D at `https://studio3d.yourdomain.com`.

---

## Troubleshooting

### AMD/ROCm Issues

**`RuntimeError: HIP error: invalid device function`**
```bash
# Set GFX version override
export HSA_OVERRIDE_GFX_VERSION=11.0.0
```

**`RuntimeError: No HIP-capable devices detected`**
```bash
# Check ROCm sees your GPU
rocminfo | grep -A2 "Marketing Name"
# If empty, check driver:
sudo dkms status
```

**Models loading very slowly on AMD**
```bash
# Enable HIP cache (persists compiled kernels)
export MIOPEN_USER_DB_PATH=/tmp/miopen_cache
export MIOPEN_ENABLE_LOGGING=0
```

**Out of VRAM on AMD even with 24GB**
```bash
# Force model CPU offloading (slower but works)
# Edit backend/.env:
FORCE_CPU_OFFLOAD=true
```

**WSL2 GPU not detected**

1. Ensure Windows driver is 22.x or newer
2. In WSL2: `ls /dev/dri` — should show `card0`, `renderD128`
3. Add your user to `render` and `video` groups: `sudo usermod -aG render,video $USER`
4. Restart WSL2: `wsl --shutdown`

### General Issues

**Redis connection refused**
```bash
# Start Redis manually
redis-server --daemonize yes
# Or via Docker:
docker run -d -p 6379:6379 redis:7-alpine
```

**Port 8000 already in use**
```bash
lsof -ti:8000 | xargs kill -9
```

**Celery worker not processing tasks**
```bash
# Check worker is running
celery -A tasks inspect active
# Restart worker
celery -A tasks worker --loglevel=debug
```

**FLUX.1 Dev requires HuggingFace token**

FLUX.1 Dev is a gated model. Get your token at https://huggingface.co/settings/tokens and set it in `.env`:
```bash
HF_TOKEN=hf_your_token_here
```
Then accept the model license at: https://huggingface.co/black-forest-labs/FLUX.1-dev

---

## Project Structure

```
studio3d/
├── backend/           # FastAPI + Celery + Redis
│   ├── main.py        # API endpoints
│   ├── tasks.py       # Celery task definitions
│   └── models/        # Inference modules (5 models)
├── frontend/          # Next.js 14 + React Flow canvas
│   └── src/
│       ├── app/       # Next.js pages
│       ├── components/# Node components + UI
│       └── lib/       # API client + workflow engine
├── installer/         # Tauri 2.0 desktop installer
│   ├── src/           # React installer screens
│   └── src-tauri/     # Rust backend (GPU detect, downloader, launcher)
├── scripts/
│   └── generate-manifest.py
├── studio3d-models.json  # Model update manifest
├── docker-compose.yml
├── setup.sh
└── .env.example
```
