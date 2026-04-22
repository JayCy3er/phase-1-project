import json
import os
import uuid
from pathlib import Path
from typing import Optional

# diffusers 0.32.2 / transformers 5.x compatibility — must be before any diffusers import
try:
    from transformers.utils import FLAX_WEIGHTS_NAME as _  # noqa: F401
except ImportError:
    import transformers.utils as _tu
    _tu.FLAX_WEIGHTS_NAME = "flax_model.msgpack"

import redis
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from tasks import (
    celery_app,
    task_generate_image,
    task_generate_3d,
    task_generate_video,
    task_generate_voice,
    task_generate_final,
)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent
OUTPUTS_DIR = BASE_DIR / "outputs"
VOICES_DIR = BASE_DIR / "voices"
CONFIG_PATH = BASE_DIR / "config.json"
OUTPUTS_DIR.mkdir(exist_ok=True)

with open(CONFIG_PATH) as f:
    CONFIG = json.load(f)

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="Studio3D API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/outputs", StaticFiles(directory=str(OUTPUTS_DIR)), name="outputs")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _enqueue(task_fn, *args) -> str:
    job_id = str(uuid.uuid4())
    key = f"job:{job_id}"
    # Use pipeline with single-field hset calls — compatible with Redis 3.x+.
    # hset(key, mapping={...}) requires Redis 4.0+ and fails on the Windows
    # winget build (3.0.504).
    pipe = redis_client.pipeline()
    for field, value in {"status": "queued", "progress": "0",
                         "result_url": "", "error": ""}.items():
        pipe.hset(key, field, value)
    pipe.expire(key, 86400)
    pipe.execute()

    queue_pos = redis_client.incr("queue:counter")
    redis_client.hset(key, "queue_position", queue_pos)

    task_fn.apply_async(args=[job_id, *args])
    return job_id


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------
class ImageRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = ""
    width: Optional[int] = 1024
    height: Optional[int] = 1024

class ThreeDRequest(BaseModel):
    image_url: str

class VideoRequest(BaseModel):
    image_url: str
    duration: Optional[int] = 4
    fps: Optional[int] = 24

class VoiceRequest(BaseModel):
    text: str
    voice_id: str
    emotion: Optional[float] = 0.5
    speed: Optional[float] = 1.0
    language: Optional[str] = "en"

class FinalRequest(BaseModel):
    video_url: str
    audio_url: str


# ---------------------------------------------------------------------------
# Generate endpoints
# ---------------------------------------------------------------------------
@app.post("/generate/image")
async def generate_image(req: ImageRequest):
    job_id = _enqueue(
        task_generate_image,
        req.prompt, req.negative_prompt, req.width, req.height,
        CONFIG["tier"],
    )
    return {"job_id": job_id}


@app.post("/generate/3d")
async def generate_3d(req: ThreeDRequest):
    job_id = _enqueue(task_generate_3d, req.image_url)
    return {"job_id": job_id}


@app.post("/generate/video")
async def generate_video(req: VideoRequest):
    job_id = _enqueue(task_generate_video, req.image_url, req.duration, req.fps)
    return {"job_id": job_id}


@app.post("/generate/voice")
async def generate_voice(req: VoiceRequest):
    # Resolve voice reference file
    preset_path = VOICES_DIR / "presets" / f"{req.voice_id}.wav"
    custom_path = VOICES_DIR / "custom" / f"{req.voice_id}.wav"
    if preset_path.exists():
        ref_wav = str(preset_path)
    elif custom_path.exists():
        ref_wav = str(custom_path)
    else:
        raise HTTPException(status_code=404, detail=f"Voice '{req.voice_id}' not found")

    job_id = _enqueue(
        task_generate_voice,
        req.text, ref_wav, req.emotion, req.speed, req.language,
    )
    return {"job_id": job_id}


@app.post("/generate/final")
async def generate_final(req: FinalRequest):
    job_id = _enqueue(task_generate_final, req.video_url, req.audio_url)
    return {"job_id": job_id}


# ---------------------------------------------------------------------------
# Job status
# ---------------------------------------------------------------------------
@app.get("/job/{job_id}")
async def get_job(job_id: str):
    data = redis_client.hgetall(f"job:{job_id}")
    if not data:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "status": data.get("status", "unknown"),
        "progress": int(data.get("progress", 0)),
        "result_url": data.get("result_url") or None,
        "error": data.get("error") or None,
        "queue_position": int(data.get("queue_position", 0)) if data.get("queue_position") else None,
    }


# ---------------------------------------------------------------------------
# Queue / GPU status
# ---------------------------------------------------------------------------
@app.get("/status")
async def get_status():
    """Returns queue depth and GPU VRAM usage (approximate)."""
    try:
        inspect = celery_app.control.inspect(timeout=1)
        active = inspect.active() or {}
        reserved = inspect.reserved() or {}
        queued = sum(len(v) for v in reserved.values())
        running = sum(len(v) for v in active.values())
    except Exception:
        queued = 0
        running = 0

    return {
        "queued_jobs": queued,
        "running_jobs": running,
        "vram_used_gb": _get_vram_used(),
        "vram_total_gb": 24.0,
        "tier": CONFIG["tier"],
    }


def _get_vram_used() -> float:
    try:
        import subprocess
        result = subprocess.run(
            ["rocm-smi", "--showmeminfo", "vram", "--csv"],
            capture_output=True, text=True, timeout=3,
            env={**os.environ, "HSA_OVERRIDE_GFX_VERSION": "11.0.0"},
        )
        for line in result.stdout.splitlines():
            if "Used" in line:
                parts = line.split(",")
                return round(int(parts[-1].strip()) / (1024 ** 3), 1)
    except Exception:
        pass
    return 0.0


# ---------------------------------------------------------------------------
# Voice library endpoints
# ---------------------------------------------------------------------------
@app.get("/voices")
async def list_voices():
    voices_json = VOICES_DIR / "presets" / "voices.json"
    with open(voices_json) as f:
        presets = json.load(f)
    for v in presets:
        v["category"] = "preset"
        v["preview_url"] = f"/voices/{v['id']}/preview"

    custom_voices = []
    custom_dir = VOICES_DIR / "custom"
    for wav_file in custom_dir.glob("*.wav"):
        vid = wav_file.stem
        custom_voices.append({
            "id": vid,
            "name": vid.replace("_", " ").title(),
            "style": "Custom",
            "lang": "en",
            "category": "custom",
            "preview_url": f"/voices/{vid}/preview",
        })

    return presets + custom_voices


@app.post("/voices/upload")
async def upload_voice(file: UploadFile = File(...), name: str = Form(...)):
    # Sanitize name → id
    voice_id = name.lower().replace(" ", "_").replace("-", "_")
    # Ensure unique
    custom_dir = VOICES_DIR / "custom"
    dest = custom_dir / f"{voice_id}.wav"
    content = await file.read()
    dest.write_bytes(content)
    return {"id": voice_id, "name": name}


@app.delete("/voices/{voice_id}")
async def delete_voice(voice_id: str):
    custom_path = VOICES_DIR / "custom" / f"{voice_id}.wav"
    if not custom_path.exists():
        raise HTTPException(status_code=404, detail="Custom voice not found (cannot delete presets)")
    custom_path.unlink()
    return {"deleted": voice_id}


@app.get("/voices/{voice_id}/preview")
async def preview_voice(voice_id: str):
    from fastapi.responses import FileResponse
    preset_path = VOICES_DIR / "presets" / f"{voice_id}.wav"
    custom_path = VOICES_DIR / "custom" / f"{voice_id}.wav"
    if preset_path.exists():
        return FileResponse(str(preset_path), media_type="audio/wav")
    if custom_path.exists():
        return FileResponse(str(custom_path), media_type="audio/wav")
    raise HTTPException(status_code=404, detail="Voice not found")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok", "tier": CONFIG["tier"]}
