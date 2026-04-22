"""
Video generation via LTX-Video 2B distilled.

Lazy-loads on first call and keeps the pipeline in memory.

Windows/DirectML note: bfloat16 is not supported — float16 is used instead.
ROCm (Linux) note: run with HSA_OVERRIDE_GFX_VERSION=11.0.0 in the environment.
"""
import os
import torch
from pathlib import Path

from ._device import get_device, is_directml, safe_dtype

_model_cache: dict = {}


def _get_pipe(model_dir: str):
    if "ltx" in _model_cache:
        return _model_cache["ltx"]

    device     = get_device()
    dtype      = safe_dtype(torch.bfloat16)
    model_path = os.path.join(model_dir, "ltx")

    print(f"[LTXVideo] Loading LTX-Video from {model_path} on {device} ({dtype})...")

    from diffusers import LTXImageToVideoPipeline, LTXPipeline

    # 0.9.7-distilled uses LTXImageToVideoPipeline
    pipe = LTXImageToVideoPipeline.from_pretrained(
        model_path,
        torch_dtype      = dtype,
        local_files_only = True,
    )
    pipe = pipe.to(device)

    # Memory optimizations — only supported on CUDA, not DirectML
    if not is_directml() and str(device) == "cuda":
        pipe.enable_vae_slicing()
        pipe.enable_vae_tiling()

    _model_cache["ltx"] = pipe
    print("[LTXVideo] Model loaded and cached.")
    return pipe


def generate_video(
    image_path:   str,
    prompt:       str = "A smooth cinematic motion, high quality",
    output_path:  str = "/tmp/output.mp4",
    duration_sec: int = 4,
    fps:          int = 24,
    width:        int = 768,
    height:       int = 512,
    model_dir:    str = "./models",
) -> str:
    """Animate an image into a video using LTX-Video. Returns path to saved MP4."""
    os.environ.setdefault("HSA_OVERRIDE_GFX_VERSION", "11.0.0")

    from PIL import Image
    import imageio
    import numpy as np

    pipe  = _get_pipe(model_dir)
    image = Image.open(image_path).convert("RGB").resize((width, height))

    num_frames = duration_sec * fps
    print(f"[LTXVideo] Generating {num_frames} frames ({duration_sec}s @ {fps}fps)")

    with torch.inference_mode():
        result = pipe(
            image               = image,
            prompt              = prompt,
            negative_prompt     = "worst quality, blurry, jittery, distorted",
            width               = width,
            height              = height,
            num_frames          = num_frames,
            num_inference_steps = 50,
            guidance_scale      = 3.0,
            decode_timestep     = 0.03,
            decode_noise_scale  = 0.025,
        )

    frames = result.frames[0]

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    with imageio.get_writer(output_path, fps=fps, codec="libx264", quality=8) as writer:
        for frame in frames:
            writer.append_data(np.array(frame))

    print(f"[LTXVideo] Saved MP4 to {output_path}")
    return output_path
