"""
3D model generation via TRELLIS-2.

Lazy-loads on first call and keeps the pipeline in memory.

ROCm note: always run with HSA_OVERRIDE_GFX_VERSION=11.0.0 in the environment.

Install TRELLIS before use:
    pip install git+https://github.com/microsoft/TRELLIS.git xformers
"""
import os
import torch
from pathlib import Path

_model_cache: dict = {}


def _get_device():
    return "cuda" if torch.cuda.is_available() else "cpu"


def _get_pipeline(model_dir: str):
    if "trellis" in _model_cache:
        return _model_cache["trellis"]

    device     = _get_device()
    model_path = os.path.join(model_dir, "trellis")

    print(f"[TRELLIS] Loading TRELLIS-2 from {model_path} on {device}...")

    # TRELLIS uses its own pipeline class
    # pip install git+https://github.com/microsoft/TRELLIS.git
    try:
        from trellis.pipelines import TrellisImageTo3DPipeline
        pipeline = TrellisImageTo3DPipeline.from_pretrained(model_path)
        pipeline.cuda()   # TRELLIS requires CUDA/ROCm, no CPU fallback
    except ImportError:
        raise ImportError(
            "TRELLIS not installed. Run:\n"
            "  pip install git+https://github.com/microsoft/TRELLIS.git\n"
            "  pip install xformers"
        )

    _model_cache["trellis"] = pipeline
    print("[TRELLIS] Model loaded and cached.")
    return pipeline


def generate_3d(
    image_path:   str,
    output_path:  str   = "/tmp/output.glb",
    model_dir:    str   = "./models",
    simplify:     float = 0.95,
    texture_size: int   = 1024,
) -> str:
    """
    Convert an image to a 3D GLB model using TRELLIS-2.
    Returns the path to the saved GLB file.
    """
    os.environ.setdefault("HSA_OVERRIDE_GFX_VERSION", "11.0.0")

    from PIL import Image

    pipeline = _get_pipeline(model_dir)

    image = Image.open(image_path).convert("RGBA")
    print(f"[TRELLIS] Processing image: {image_path}  ({image.size})")

    with torch.inference_mode():
        outputs = pipeline.run(
            image,
            seed             = 42,
            formats          = ["gaussian", "mesh"],
            preprocess_image = True,
        )

    # Extract mesh and export GLB
    glb = outputs["mesh"][0].export_glb(
        simplify     = simplify,
        texture_size = texture_size,
    )

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(glb)

    print(f"[TRELLIS] Saved GLB to {output_path}")
    return output_path
