#!/usr/bin/env python3
"""
Studio3D — Placeholder Voice Generator
---------------------------------------
Creates synthetic 6-second WAV files for each voice preset using only Python
stdlib (wave + math). No network, no extra pip packages required.

These are NOT real voice clones — they are sine-wave tones that satisfy
Chatterbox's "audio prompt must be longer than 5 seconds" requirement so you
can test the pipeline immediately.

Run download_vctk_voices.py afterward to replace them with real voice samples.

Usage:
    python scripts/generate_placeholder_voices.py
"""

import json
import math
import os
import struct
import wave

# Each entry: (id, fundamental_hz)
# Rough human voice fundamentals: male ~85-180 Hz, female ~165-255 Hz
VOICE_TONES = [
    ("narrator",     110),   # deep male
    ("sarah",        200),   # warm female
    ("british_male", 130),   # male
    ("storyteller",  100),   # gravelly male
    ("news_anchor",  210),   # clear female
    ("young_male",   150),   # energetic male
    ("elder_female", 185),   # mature female
    ("whisperer",    230),   # soft female
    ("villain",       90),   # low male
]

SAMPLE_RATE   = 24_000
DURATION_SEC  = 6           # >5s required by Chatterbox
AMPLITUDE     = 0.3         # keep it quiet (0–1)

OUTPUT_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "backend", "voices", "presets"
)


def _write_wav(path: str, freq: float):
    n_samples = SAMPLE_RATE * DURATION_SEC
    samples   = []
    for i in range(n_samples):
        t   = i / SAMPLE_RATE
        # Add a few harmonics so it vaguely resembles a voice
        val = (
            AMPLITUDE * math.sin(2 * math.pi * freq * t)
            + (AMPLITUDE * 0.4) * math.sin(2 * math.pi * freq * 2 * t)
            + (AMPLITUDE * 0.2) * math.sin(2 * math.pi * freq * 3 * t)
        )
        # Clamp to 16-bit PCM range
        sample_int = max(-32768, min(32767, int(val * 32767)))
        samples.append(struct.pack("<h", sample_int))

    with wave.open(path, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(b"".join(samples))


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    generated = 0

    for voice_id, freq in VOICE_TONES:
        out_path = os.path.join(OUTPUT_DIR, f"{voice_id}.wav")

        # Check existing file duration
        if os.path.exists(out_path):
            try:
                with wave.open(out_path) as wf:
                    existing_dur = wf.getnframes() / wf.getframerate()
                if existing_dur >= 5.5:
                    print(f"  SKIP  {voice_id}.wav  ({existing_dur:.1f}s — already long enough)")
                    continue
            except Exception:
                pass  # corrupt file — regenerate

        _write_wav(out_path, freq)
        size_kb = os.path.getsize(out_path) // 1024
        print(f"  OK    {voice_id}.wav  ({DURATION_SEC}s, {freq}Hz, {size_kb}KB)")
        generated += 1

    print(f"\nDone — {generated} placeholder WAV(s) written to:")
    print(f"  {os.path.abspath(OUTPUT_DIR)}")
    if generated:
        print("\nThese are tone-only placeholders — no real voice character.")
        print("Run  python scripts/download_vctk_voices.py  for real voice samples.")


if __name__ == "__main__":
    main()
