#!/usr/bin/env python3
"""
Studio3D — Voice Preset Downloader
------------------------------------
Downloads one 10-second reference clip per preset voice from LibriSpeech
test-clean (CC-BY 4.0) via Hugging Face datasets (parquet format, no loading
script required — works with datasets>=4.0).

Run this ONCE after the project is set up:
    pip install datasets soundfile numpy librosa
    python scripts/download_vctk_voices.py

Output:
    backend/voices/presets/{id}.wav  (one per voice, 10s @ 24kHz)
    backend/voices/presets/voices.json

License: LibriSpeech is derived from LibriVox (public domain audiobooks).
"""
import os
import json
import soundfile as sf
import numpy as np

# ---------------------------------------------------------------------------
# Voice preset → LibriSpeech test-clean speaker mapping
# Speaker IDs are integers; gender/style are approximate based on recordings.
# ---------------------------------------------------------------------------
VOICE_MAP = [
    {
        "id":      "narrator",
        "name":    "Narrator",
        "style":   "Deep calm male",
        "lang":    "en",
        "speaker": 1089,   # male
    },
    {
        "id":      "sarah",
        "name":    "Sarah",
        "style":   "Warm friendly female",
        "lang":    "en",
        "speaker": 1188,   # female
    },
    {
        "id":      "british_male",
        "name":    "British Male",
        "style":   "Clear male voice",
        "lang":    "en",
        "speaker": 1284,   # male
    },
    {
        "id":      "storyteller",
        "name":    "Storyteller",
        "style":   "Expressive male",
        "lang":    "en",
        "speaker": 1580,   # male
    },
    {
        "id":      "news_anchor",
        "name":    "News Anchor",
        "style":   "Clear neutral female",
        "lang":    "en",
        "speaker": 1221,   # female
    },
    {
        "id":      "young_male",
        "name":    "Young Male",
        "style":   "Energetic male",
        "lang":    "en",
        "speaker": 2094,   # male
    },
    {
        "id":      "elder_female",
        "name":    "Elder Female",
        "style":   "Warm mature female",
        "lang":    "en",
        "speaker": 2830,   # female
    },
    {
        "id":      "whisperer",
        "name":    "Whisperer",
        "style":   "Soft female voice",
        "lang":    "en",
        "speaker": 3575,   # female
    },
    {
        "id":      "villain",
        "name":    "Villain",
        "style":   "Low resonant male",
        "lang":    "en",
        "speaker": 4970,   # male
    },
]

TARGET_SAMPLE_RATE = 24_000
CLIP_DURATION_SEC  = 10

OUTPUT_DIR = os.path.join(
    os.path.dirname(__file__), "..", "backend", "voices", "presets"
)


def download_and_prep():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Loading LibriSpeech test-clean from Hugging Face...")
    print("(~368MB download, cached in ~/.cache/huggingface afterward)\n")

    try:
        from datasets import load_dataset
    except ImportError:
        print("ERROR: Install required packages first:")
        print("  pip install datasets soundfile numpy librosa")
        return

    ds = load_dataset(
        "openslr/librispeech_asr",
        "clean",
        split="test",
        streaming=True,
    )

    needed  = {v["speaker"]: v for v in VOICE_MAP}
    found   = {}

    print(f"Scanning dataset for {len(needed)} speakers...\n")
    for sample in ds:
        sid = sample["speaker_id"]
        if sid in needed and sid not in found:
            found[sid] = sample
            voice_cfg  = needed[sid]
            _save_clip(sample, voice_cfg)
            print(f"  ✅ {voice_cfg['name']:20s}  speaker={sid}")
        if len(found) == len(needed):
            break

    missing = set(needed.keys()) - set(found.keys())
    if missing:
        print(f"\n⚠️  Could not find {len(missing)} speaker(s): {missing}")
        print("   Edit VOICE_MAP in this script to use different speaker IDs.")
        print("   Find valid IDs by browsing: openslr/librispeech_asr on HuggingFace")

    _write_manifest()
    print(f"\n✅ Done — voice presets saved to: {os.path.abspath(OUTPUT_DIR)}")
    print("   Restart the Studio3D backend to pick up the new voice files.")


def _save_clip(sample: dict, voice_cfg: dict):
    """Resample, trim/loop to CLIP_DURATION_SEC, and save as PCM-16 WAV."""
    audio_array = np.array(sample["audio"]["array"], dtype=np.float32)
    src_sr      = sample["audio"]["sampling_rate"]

    if src_sr != TARGET_SAMPLE_RATE:
        try:
            import librosa
            audio_array = librosa.resample(
                audio_array, orig_sr=src_sr, target_sr=TARGET_SAMPLE_RATE
            )
        except ImportError:
            new_len     = int(len(audio_array) * TARGET_SAMPLE_RATE / src_sr)
            audio_array = np.interp(
                np.linspace(0, len(audio_array), new_len),
                np.arange(len(audio_array)),
                audio_array,
            )

    target_len = TARGET_SAMPLE_RATE * CLIP_DURATION_SEC

    if len(audio_array) >= target_len:
        audio_array = audio_array[:target_len]
    else:
        repeats     = int(np.ceil(target_len / len(audio_array)))
        audio_array = np.tile(audio_array, repeats)[:target_len]

    out_path = os.path.join(OUTPUT_DIR, f"{voice_cfg['id']}.wav")
    sf.write(out_path, audio_array, TARGET_SAMPLE_RATE, subtype="PCM_16")


def _write_manifest():
    manifest = []
    for v in VOICE_MAP:
        wav_path = os.path.join(OUTPUT_DIR, f"{v['id']}.wav")
        size_kb  = round(os.path.getsize(wav_path) / 1024) if os.path.exists(wav_path) else 0
        manifest.append({
            "id":      v["id"],
            "name":    v["name"],
            "style":   v["style"],
            "lang":    v["lang"],
            "speaker": str(v["speaker"]),
            "size_kb": size_kb,
        })
    out_path = os.path.join(OUTPUT_DIR, "voices.json")
    with open(out_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\n📄 Updated voices.json  →  {os.path.abspath(out_path)}")


if __name__ == "__main__":
    download_and_prep()
