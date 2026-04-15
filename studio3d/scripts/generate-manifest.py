#!/usr/bin/env python3
"""
generate-manifest.py — Studio3D model update manifest generator.

Usage:
    python scripts/generate-manifest.py

What it does:
1. Reads the current studio3d-models.json
2. Scans ./models/ for each model's main weight file
3. Computes SHA256 of each weight file
4. Prompts user to bump version numbers
5. Writes updated studio3d-models.json with real SHA256 hashes

After running, upload studio3d-models.json to your website to push updates.
"""
import hashlib
import json
import sys
from pathlib import Path

MANIFEST_PATH = Path(__file__).parent.parent / "studio3d-models.json"
MODELS_DIR    = Path(__file__).parent.parent / "models"

# Map model id → relative path within its model dir to the main weight file
WEIGHT_FILES: dict[str, list[str]] = {
    "flux":       ["flux1-dev.safetensors", "model.safetensors"],
    "sd35":       ["sd3.5_medium.safetensors", "model.safetensors"],
    "trellis":    ["model.safetensors", "model.pth"],
    "ltx":        ["ltx-video-2b-v0.9.7-distilled.safetensors", "model.safetensors"],
    "chatterbox": ["model.pth", "model.safetensors"],
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8 * 1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def find_weight(model_id: str) -> Path | None:
    model_dir = MODELS_DIR / model_id
    if not model_dir.exists():
        return None
    for filename in WEIGHT_FILES.get(model_id, []):
        p = model_dir / filename
        if p.exists():
            return p
    # Fallback: first .safetensors or .pth file
    for ext in ("*.safetensors", "*.pth", "*.bin"):
        files = list(model_dir.glob(ext))
        if files:
            return files[0]
    return None


def bump_version(current: str, name: str) -> str:
    response = input(f"  {name} — current version: {current}\n  New version (Enter to keep): ").strip()
    return response if response else current


def main() -> None:
    if not MANIFEST_PATH.exists():
        print(f"❌ {MANIFEST_PATH} not found. Run from the studio3d/ root.", file=sys.stderr)
        sys.exit(1)

    with MANIFEST_PATH.open() as f:
        manifest = json.load(f)

    print("=" * 60)
    print("  Studio3D — Manifest Generator")
    print("=" * 60)
    print()

    changed = False

    for tier_name, tier_data in manifest.get("tiers", {}).items():
        print(f"Tier: {tier_name}")
        for model in tier_data.get("models", []):
            model_id = model["id"]
            name     = model["name"]

            weight = find_weight(model_id)
            if weight is None:
                print(f"  ⚠️  {name}: weight file not found in ./models/{model_id}/ — skipping SHA256")
                sha = model.get("sha256", "PLACEHOLDER")
            else:
                print(f"  Computing SHA256 for {name} ({weight.name})…", end=" ", flush=True)
                sha = sha256_file(weight)
                print("done")
                if sha != model.get("sha256"):
                    model["sha256"] = sha
                    changed = True

            # Version bump
            old_ver = model.get("version", "1.0.0")
            new_ver = bump_version(old_ver, name)
            if new_ver != old_ver:
                model["version"] = new_ver
                changed = True
        print()

    # Update voices
    for voice in manifest.get("voices", []):
        voice_id  = voice["id"]
        voice_wav = Path(__file__).parent.parent / "backend" / "voices" / "presets" / f"{voice_id}.wav"
        if voice_wav.exists():
            sha = sha256_file(voice_wav)
            if sha != voice.get("sha256"):
                voice["sha256"] = sha
                changed = True

    # Save
    if changed:
        with MANIFEST_PATH.open("w") as f:
            json.dump(manifest, f, indent=2)
        print("✅ studio3d-models.json updated with real SHA256 hashes.")
    else:
        print("✅ No changes detected — studio3d-models.json is up to date.")

    print()
    print("Next step: upload studio3d-models.json to your website to push updates.")
    print(f"  e.g.: rsync studio3d-models.json user@yourserver:/var/www/html/")
    print()


if __name__ == "__main__":
    main()
