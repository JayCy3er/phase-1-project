"""
Celery task definitions for Studio3D pipeline.

All tasks follow the pattern:
  1. Update job status → "running"
  2. Resolve any /outputs/ URL to an absolute local path
  3. Call the model inference function
  4. Save output to ./outputs/{job_id}/result.{ext}
  5. Update job status → "done" with result_url

On any exception: status → "error" with message.
"""
import os
import sys
from pathlib import Path

# Ensure backend/ is on the path so `from models.x import ...` always works
sys.path.insert(0, str(Path(__file__).parent))

# diffusers 0.32.2 imports FLAX_WEIGHTS_NAME from transformers.utils, which was
# removed in transformers 5.x. Inject it into the already-loaded module namespace
# before any diffusers import happens so the 'from transformers.utils import ...'
# inside pipeline_loading_utils.py finds it without an ImportError.
try:
    from transformers.utils import FLAX_WEIGHTS_NAME as _  # noqa: F401
except ImportError:
    import transformers.utils as _tu
    _tu.FLAX_WEIGHTS_NAME = "flax_model.msgpack"

import redis
from celery import Celery

# ---------------------------------------------------------------------------
# Celery / Redis setup
# ---------------------------------------------------------------------------
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
celery_app = Celery("studio3d", broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    worker_concurrency=1,       # one task at a time per GPU
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

redis_client = redis.from_url(REDIS_URL, decode_responses=True)

BASE_DIR    = Path(__file__).parent
OUTPUTS_DIR = BASE_DIR / "outputs"
MODEL_DIR   = os.environ.get("MODEL_DIR", str(BASE_DIR.parent / "models"))
OUTPUTS_DIR.mkdir(exist_ok=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _set_status(job_id: str, status: str, progress: int = 0,
                result_url: str = "", error: str = ""):
    # Single-field hset calls — compatible with Redis 3.x on Windows.
    pipe = redis_client.pipeline()
    for field, value in {"status": status, "progress": str(progress),
                         "result_url": result_url, "error": error}.items():
        pipe.hset(f"job:{job_id}", field, value)
    pipe.execute()


def _job_output_dir(job_id: str) -> Path:
    d = OUTPUTS_DIR / job_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _resolve_path(url_or_path: str) -> str:
    """Convert a /outputs/{job_id}/result.ext URL to an absolute filesystem path."""
    if url_or_path.startswith("/outputs/"):
        return str(BASE_DIR / url_or_path.lstrip("/"))
    return url_or_path


# ---------------------------------------------------------------------------
# Image generation task
# ---------------------------------------------------------------------------
@celery_app.task(bind=True, name="tasks.generate_image")
def task_generate_image(self, job_id: str, prompt: str, negative_prompt: str,
                        width: int, height: int, tier: str):
    try:
        _set_status(job_id, "running", progress=5)

        from models.image_gen import generate_image
        output_dir = _job_output_dir(job_id)
        generate_image(
            prompt          = prompt,
            negative_prompt = negative_prompt,
            width           = width,
            height          = height,
            output_path     = str(output_dir / "result.png"),
            tier            = tier,
            model_dir       = MODEL_DIR,
        )

        _set_status(job_id, "done", progress=100,
                    result_url=f"/outputs/{job_id}/result.png")
    except Exception as exc:
        _set_status(job_id, "error", error=str(exc))
        raise


# ---------------------------------------------------------------------------
# 3D generation task
# ---------------------------------------------------------------------------
@celery_app.task(bind=True, name="tasks.generate_3d")
def task_generate_3d(self, job_id: str, image_url: str):
    try:
        _set_status(job_id, "running", progress=5)

        from models.threed_gen import generate_3d
        output_dir = _job_output_dir(job_id)
        generate_3d(
            image_path  = _resolve_path(image_url),
            output_path = str(output_dir / "result.glb"),
            model_dir   = MODEL_DIR,
        )

        _set_status(job_id, "done", progress=100,
                    result_url=f"/outputs/{job_id}/result.glb")
    except Exception as exc:
        _set_status(job_id, "error", error=str(exc))
        raise


# ---------------------------------------------------------------------------
# Video generation task
# ---------------------------------------------------------------------------
@celery_app.task(bind=True, name="tasks.generate_video")
def task_generate_video(self, job_id: str, image_url: str, duration: int, fps: int):
    try:
        _set_status(job_id, "running", progress=5)

        from models.video_gen import generate_video
        output_dir = _job_output_dir(job_id)
        generate_video(
            image_path   = _resolve_path(image_url),
            output_path  = str(output_dir / "result.mp4"),
            duration_sec = duration,
            fps          = fps,
            model_dir    = MODEL_DIR,
        )

        _set_status(job_id, "done", progress=100,
                    result_url=f"/outputs/{job_id}/result.mp4")
    except Exception as exc:
        _set_status(job_id, "error", error=str(exc))
        raise


# ---------------------------------------------------------------------------
# Voice generation task
# ---------------------------------------------------------------------------
@celery_app.task(bind=True, name="tasks.generate_voice")
def task_generate_voice(self, job_id: str, text: str, ref_wav: str,
                        emotion: float, speed: float, language: str):
    try:
        _set_status(job_id, "running", progress=5)

        from models.voice_gen import generate_voice
        output_dir = _job_output_dir(job_id)
        generate_voice(
            text              = text,
            voice_ref_path    = ref_wav,
            output_path       = str(output_dir / "result.wav"),
            emotion_intensity = emotion,
            speed             = speed,
            language          = language,
        )

        _set_status(job_id, "done", progress=100,
                    result_url=f"/outputs/{job_id}/result.wav")
    except Exception as exc:
        _set_status(job_id, "error", error=str(exc))
        raise


# ---------------------------------------------------------------------------
# Final merge task
# ---------------------------------------------------------------------------
@celery_app.task(bind=True, name="tasks.generate_final")
def task_generate_final(self, job_id: str, video_url: str, audio_url: str):
    try:
        _set_status(job_id, "running", progress=5)

        from models.merge import merge_video_audio
        output_dir = _job_output_dir(job_id)
        merge_video_audio(
            video_path  = _resolve_path(video_url),
            audio_path  = _resolve_path(audio_url),
            output_path = str(output_dir / "result.mp4"),
        )

        _set_status(job_id, "done", progress=100,
                    result_url=f"/outputs/{job_id}/result.mp4")
    except Exception as exc:
        _set_status(job_id, "error", error=str(exc))
        raise
