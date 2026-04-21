"""
Image generation via FLUX.1 Dev (full tier) or SD 3.5 Medium (lite tier).

Lazy-loads on first call and keeps the pipeline in memory.

Windows/DirectML note: bfloat16 is not supported — float16 is used instead.
ROCm (Linux) note: run with HSA_OVERRIDE_GFX_VERSION=11.0.0 in the environment.
"""
import os
import torch
from pathlib import Path
from diffusers import FluxPipeline

from ._device import get_device, is_directml, safe_dtype

_model_cache: dict = {}


def _get_pipe(tier: str, model_dir: str):
    if "image" in _model_cache:
        return _model_cache["image"]

    device = get_device()
    dtype  = safe_dtype(torch.bfloat16)   # bfloat16 on CUDA, float16 on DirectML

    if tier == "full":
        model_path = os.path.join(model_dir, "flux")
        print(f"[ImageGen] Loading FLUX.1 Dev from {model_path} on {device} ({dtype})...")
        pipe = FluxPipeline.from_pretrained(
            model_path,
            torch_dtype=dtype,
            local_files_only=True,
        )
        pipe = pipe.to(device)
    else:
        from diffusers import StableDiffusion3Pipeline
        model_path = os.path.join(model_dir, "sd35")
        print(f"[ImageGen] Loading SD 3.5 Medium from {model_path} on {device} ({dtype})...")
        pipe = StableDiffusion3Pipeline.from_pretrained(
            model_path,
            torch_dtype=dtype,
            local_files_only=True,
        )
        pipe = pipe.to(device)

    _model_cache["image"] = pipe
    print("[ImageGen] Model loaded and cached.")
    return pipe


def generate_image(
    prompt:          str,
    negative_prompt: str   = "",
    width:           int   = 1024,
    height:          int   = 1024,
    guidance_scale:  float = 3.5,
    num_steps:       int   = 28,
    output_path:     str   = "/tmp/output.png",
    tier:            str   = "full",
    model_dir:       str   = "./models",
) -> str:
    """Run image generation inference. Returns path to saved PNG."""
    os.environ.setdefault("HSA_OVERRIDE_GFX_VERSION", "11.0.0")

    pipe = _get_pipe(tier, model_dir)

    print(f"[ImageGen] Generating: '{prompt[:60]}...' ({width}x{height}, {num_steps} steps)")

    with torch.inference_mode():
        if tier == "full":
            result = pipe(
                prompt              = prompt,
                width               = width,
                height              = height,
                guidance_scale      = guidance_scale,
                num_inference_steps = num_steps,
                max_sequence_length = 512,
            )
        else:
            result = pipe(
                prompt              = prompt,
                negative_prompt     = negative_prompt,
                width               = width,
                height              = height,
                guidance_scale      = guidance_scale,
                num_inference_steps = num_steps,
            )

    image = result.images[0]
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path)
    print(f"[ImageGen] Saved to {output_path}")
    return output_path
