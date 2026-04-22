"""
Download Studio3D AI models from HuggingFace.

Usage:
    python scripts/download_models.py              # full tier (FLUX + LTX-Video)
    python scripts/download_models.py --tier lite  # lite tier (SD 3.5 + LTX-Video)
    python scripts/download_models.py --skip-video # skip LTX-Video (saves ~10 GB)

FLUX.1 Dev and SD 3.5 Medium are gated models — you must:
  1. Create a HuggingFace account at https://huggingface.co
  2. Accept the model license on the model page
  3. Run: huggingface-cli login   (or set HF_TOKEN env var)

Chatterbox TTS downloads its own weights on first inference — no action needed.
TRELLIS-2 requires CUDA (not DirectML) so it is skipped on Windows.
"""
import argparse
import json
import os
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Resolve paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
STUDIO_DIR = SCRIPT_DIR.parent
MODELS_DIR = STUDIO_DIR / "models"
CONFIG_PATH = STUDIO_DIR / "backend" / "config.json"

MODELS_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------
MODELS = {
    "flux": {
        "repo_id":   "black-forest-labs/FLUX.1-dev",
        "local_dir": MODELS_DIR / "flux",
        "gated":     True,
        "size_gb":   24,
        "tier":      "full",
    },
    "sd35": {
        "repo_id":   "stabilityai/stable-diffusion-3.5-medium",
        "local_dir": MODELS_DIR / "sd35",
        "gated":     True,
        "size_gb":   5,
        "tier":      "lite",
    },
    "ltx": {
        "repo_id":   "Lightricks/LTX-Video-0.9.7-distilled",
        "local_dir": MODELS_DIR / "ltx",
        "gated":     False,
        "size_gb":   6,
        "tier":      "both",
    },
}


def check_hf_auth():
    """Return True if a HuggingFace token is available."""
    if os.environ.get("HF_TOKEN"):
        return True
    token_file = Path.home() / ".cache" / "huggingface" / "token"
    if token_file.exists() and token_file.read_text().strip():
        return True
    return False


def download_model(name: str, info: dict, token: str = None):
    from huggingface_hub import snapshot_download

    local_dir = info["local_dir"]

    if local_dir.exists() and any(local_dir.iterdir()):
        print(f"  [SKIP] {name} already exists at {local_dir}")
        return

    print(f"  [GET]  {info['repo_id']}  (~{info['size_gb']} GB) → {local_dir}")
    snapshot_download(
        repo_id   = info["repo_id"],
        local_dir = str(local_dir),
        token     = token,
        ignore_patterns = ["*.msgpack", "*.h5", "flax_model*", "tf_model*",
                           "rust_model*", "onnx*"],
    )
    print(f"  [DONE] {name}")


def main():
    parser = argparse.ArgumentParser(description="Download Studio3D models")
    parser.add_argument("--tier", choices=["full", "lite"], default=None,
                        help="Override tier from config.json")
    parser.add_argument("--skip-video", action="store_true",
                        help="Skip LTX-Video download (~10 GB)")
    args = parser.parse_args()

    # Determine tier
    tier = args.tier
    if tier is None:
        if CONFIG_PATH.exists():
            with open(CONFIG_PATH) as f:
                tier = json.load(f).get("tier", "full")
        else:
            tier = "full"

    print(f"\nStudio3D Model Downloader")
    print(f"Tier: {tier}  |  Models dir: {MODELS_DIR}\n")

    # Check HF auth for gated models
    token = os.environ.get("HF_TOKEN") or None
    has_auth = check_hf_auth()

    gated_needed = any(
        m["gated"] for k, m in MODELS.items()
        if m["tier"] in (tier, "both") and not (k == "ltx" and args.skip_video)
    )

    if gated_needed and not has_auth:
        print("ERROR: FLUX.1 Dev and SD 3.5 are gated models that require a")
        print("       HuggingFace account and license agreement.")
        print()
        print("  1. Sign up at https://huggingface.co")
        if tier == "full":
            print("  2. Accept terms at https://huggingface.co/black-forest-labs/FLUX.1-dev")
        else:
            print("  2. Accept terms at https://huggingface.co/stabilityai/stable-diffusion-3.5-medium")
        print("  3. Run:  huggingface-cli login")
        print()
        sys.exit(1)

    # Download
    for name, info in MODELS.items():
        if name == "ltx" and args.skip_video:
            print(f"  [SKIP] ltx (--skip-video)")
            continue
        if info["tier"] not in (tier, "both"):
            continue
        download_model(name, info, token=token)

    print("\nAll models downloaded.")
    print("Voice model (Chatterbox) downloads automatically on first use.")
    print("\nRun start.bat to launch Studio3D.")


if __name__ == "__main__":
    main()
