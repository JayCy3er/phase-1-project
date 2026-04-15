"""
Final video + audio mux via FFmpeg.

Audio is trimmed or looped to match video duration automatically.
"""
import os
import shutil
import subprocess
from pathlib import Path


def merge_video_audio(
    video_path:  str,
    audio_path:  str,
    output_path: str = "/tmp/final.mp4",
) -> str:
    """
    Mux video and audio into a final MP4 using FFmpeg.
    Audio is trimmed or looped to match video duration.
    Returns path to the merged MP4.
    """
    if not shutil.which("ffmpeg"):
        raise RuntimeError(
            "ffmpeg not found. Install it:\n"
            "  Ubuntu/WSL2:  sudo apt install ffmpeg\n"
            "  Windows:      winget install ffmpeg"
        )

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    # Get video duration via ffprobe
    probe_cmd = [
        "ffprobe", "-v", "quiet",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path,
    ]
    result   = subprocess.run(probe_cmd, capture_output=True, text=True)
    duration = float(result.stdout.strip()) if result.stdout.strip() else None

    env = {**os.environ, "HSA_OVERRIDE_GFX_VERSION": "11.0.0"}

    if duration:
        # Loop audio to cover full video duration, then trim
        cmd = [
            "ffmpeg", "-y",
            "-i", video_path,
            "-stream_loop", "-1",
            "-i", audio_path,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-t", str(duration),
            "-movflags", "+faststart",
            output_path,
        ]
    else:
        # No duration info — just mux and stop at shortest stream
        cmd = [
            "ffmpeg", "-y",
            "-i", video_path,
            "-i", audio_path,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            "-movflags", "+faststart",
            output_path,
        ]

    print(f"[Merge] Muxing video + audio → {output_path}")
    proc = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=300)

    if proc.returncode != 0:
        raise RuntimeError(f"FFmpeg error:\n{proc.stderr}")

    print(f"[Merge] Done  →  {output_path}")
    return output_path
