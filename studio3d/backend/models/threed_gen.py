"""
3D model generation via TRELLIS-2.

Lazy-loads on first call and keeps the pipeline in memory.

Note: TRELLIS relies on CUDA-specific kernels (triton, flash-attn).
On Windows with DirectML the pipeline falls back to "cuda" if available,
otherwise raises a clear error — 3D generation requires a CUDA GPU on Linux
or a CUDA-capable GPU on Windows with the CUDA toolkit installed.
"""
import os
import torch
from pathlib import Path

from ._device import device_str

_model_cache: dict = {}


def _trellis_device() -> str:
    """TRELLIS needs CUDA. Return 'cuda' if available, else raise."""
    if torch.cuda.is_available():
        return "cuda"
    raise RuntimeError(
        "TRELLIS-2 requires a CUDA-capable GPU.\n"
        "On Windows, install the NVIDIA CUDA toolkit or use a Linux system with ROCm.\n"
        "DirectML is not supported by TRELLIS due to triton kernel requirements."
    )


def _get_pipeline(model_dir: str):
    if "trellis" in _model_cache:
        return _model_cache["trellis"]

    device     = _trellis_device()
    model_path = os.path.join(model_dir, "trellis")

    print(f"[TRELLIS] Loading TRELLIS-2 from {model_path} on {device}...")

    try:
        from trellis.pipelines import TrellisImageTo3DPipeline
        pipeline = TrellisImageTo3DPipeline.from_pretrained(model_path)
        pipeline.to(device)
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
    """Convert an image to a 3D GLB model using TRELLIS-2. Returns path to saved GLB."""
    os.environ.setdefault("HSA_OVERRIDE_GFX_VERSION", "11.0.0")

    from PIL import Image

    pipeline = _get_pipeline(model_dir)
    image    = Image.open(image_path).convert("RGBA")
    print(f"[TRELLIS] Processing image: {image_path}  ({image.size})")

    with torch.inference_mode():
        outputs = pipeline.run(
            image,
            seed             = 42,
            formats          = ["gaussian", "mesh"],
            preprocess_image = True,
        )

    glb = outputs["mesh"][0].export_glb(
        simplify     = simplify,
        texture_size = texture_size,
    )

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(glb)

    print(f"[TRELLIS] Saved GLB to {output_path}")
    return output_path
