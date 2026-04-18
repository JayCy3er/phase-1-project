#!/usr/bin/env python3
"""
Studio3D — VCTK Voice Preset Downloader
-----------------------------------------
Downloads one 10-second reference clip per preset voice from the
CSTR VCTK Corpus (CC-BY 4.0) via Hugging Face datasets.

Run this ONCE after the project is set up:
    pip install datasets soundfile numpy librosa
    python scripts/download_vctk_voices.py

Output:
    backend/voices/presets/{id}.wav  (one per voice, 10s @ 24kHz)
    backend/voices/presets/voices.json (updated with real speaker metadata)

License: VCTK corpus is CC-BY 4.0. Attribution:
    Yamagishi, Junichi; Veaux, Christophe; MacDonald, Kirsten. (2019).
    CSTR VCTK Corpus: English Multi-speaker Corpus for CSTR Voice Cloning Toolkit
    (version 0.92). University of Edinburgh. The Centre for Speech Technology Research (CSTR).
    https://doi.org/10.7488/ds/2645
"""
import os
import json
import soundfile as sf
import numpy as np

# ---------------------------------------------------------------------------
# Voice preset → VCTK speaker mapping
# Speaker metadata from VCTK 0.92 speaker-info.txt
# ---------------------------------------------------------------------------
VOICE_MAP = [
    {
        "id":      "narrator",
        "name":    "Narrator",
        "style":   "Deep calm male",
        "lang":    "en",
        "speaker": "p226",   # Male, English
        "utt":     "001",
    },
    {
        "id":      "sarah",
        "name":    "Sarah",
        "style":   "Warm friendly female",
        "lang":    "en",
        "speaker": "p225",   # Female, Southern England
        "utt":     "003",
    },
    {
        "id":      "british_male",
        "name":    "British Male",
        "style":   "RP accent male",
        "lang":    "en",
        "speaker": "p234",   # Male, Scottish
        "utt":     "002",
    },
    {
        "id":      "storyteller",
        "name":    "Storyteller",
        "style":   "Gravelly dramatic male",
        "lang":    "en",
        "speaker": "p260",   # Male, deep voice
        "utt":     "004",
    },
    {
        "id":      "news_anchor",
        "name":    "News Anchor",
        "style":   "Clear neutral female",
        "lang":    "en",
        "speaker": "p236",   # Female, clear diction
        "utt":     "002",
    },
    {
        "id":      "young_male",
        "name":    "Young Male",
        "style":   "Energetic casual male",
        "lang":    "en",
        "speaker": "p245",   # Male, young
        "utt":     "001",
    },
    {
        "id":      "elder_female",
        "name":    "Elder Female",
        "style":   "Warm mature female",
        "lang":    "en",
        "speaker": "p266",   # Female, mature
        "utt":     "003",
    },
    {
        "id":      "whisperer",
        "name":    "Whisperer",
        "style":   "Soft intimate female",
        "lang":    "en",
        "speaker": "p229",   # Female, soft tone
        "utt":     "002",
    },
    {
        "id":      "villain",
        "name":    "Villain",
        "style":   "Low menacing male",
        "lang":    "en",
        "speaker": "p274",   # Male, low resonant
        "utt":     "001",
    },
]

TARGET_SAMPLE_RATE = 24_000   # Chatterbox native sample rate
CLIP_DURATION_SEC  = 10       # Target clip length in seconds

OUTPUT_DIR = os.path.join(
    os.path.dirname(__file__), "..", "backend", "voices", "presets"
)


def download_and_prep():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Loading VCTK dataset from Hugging Face...")
    print("(~11GB download on first run, cached in ~/.cache/huggingface afterward)\n")

    try:
        from datasets import load_dataset
        import datasets as _ds_mod
        _ds_version = tuple(int(x) for x in _ds_mod.__version__.split(".")[:2])
        if _ds_version >= (4, 0):
            print("ERROR: datasets>=4.0 dropped loading-script support.")
            print("  Fix: pip install 'datasets>=3.0,<4.0'")
            return
    except ImportError:
        print("ERROR: Install required packages first:")
        print("  pip install 'datasets>=3.0,<4.0' soundfile numpy librosa")
        return

    # Streaming mode — avoids downloading the full 11GB up front
    ds = load_dataset(
        "CSTR-Edinburgh/vctk",
        split="train",
        streaming=True,
        trust_remote_code=True,
    )

    needed = {(v["speaker"], v["utt"]): v for v in VOICE_MAP}
    found  = {}

    print(f"Scanning dataset for {len(needed)} voice samples...\n")
    for sample in ds:
        key = (sample["speaker_id"], sample["text_id"])
        if key in needed and key not in found:
            found[key] = sample
            voice_cfg  = needed[key]
            _save_clip(sample, voice_cfg)
            print(f"  ✅ {voice_cfg['name']:20s}  "
                  f"speaker={voice_cfg['speaker']}  "
                  f"utt={voice_cfg['utt']}")
        if len(found) == len(needed):
            break

    missing = set(needed.keys()) - set(found.keys())
    if missing:
        print(f"\n⚠️  Could not find {len(missing)} sample(s): {missing}")
        print("   Try changing the 'utt' number in VOICE_MAP in this script.")

    _write_manifest()
    print(f"\n✅ Done — voice presets saved to: {os.path.abspath(OUTPUT_DIR)}")
    print("   Restart the Studio3D backend to pick up the new voice files.")


def _save_clip(sample: dict, voice_cfg: dict):
    """Resample, trim/loop to CLIP_DURATION_SEC, and save as PCM-16 WAV."""
    audio_array = np.array(sample["audio"]["array"], dtype=np.float32)
    src_sr      = sample["audio"]["sampling_rate"]

    # Resample to Chatterbox native rate
    if src_sr != TARGET_SAMPLE_RATE:
        try:
            import librosa
            audio_array = librosa.resample(
                audio_array, orig_sr=src_sr, target_sr=TARGET_SAMPLE_RATE
            )
        except ImportError:
            # Naive linear-interpolation resample fallback (no librosa)
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
        # Tile until long enough, then trim
        repeats     = int(np.ceil(target_len / len(audio_array)))
        audio_array = np.tile(audio_array, repeats)[:target_len]

    out_path = os.path.join(OUTPUT_DIR, f"{voice_cfg['id']}.wav")
    sf.write(out_path, audio_array, TARGET_SAMPLE_RATE, subtype="PCM_16")


def _write_manifest():
    """Update voices.json with real speaker metadata and file sizes."""
    manifest = []
    for v in VOICE_MAP:
        wav_path = os.path.join(OUTPUT_DIR, f"{v['id']}.wav")
        size_kb  = round(os.path.getsize(wav_path) / 1024) if os.path.exists(wav_path) else 0
        manifest.append({
            "id":      v["id"],
            "name":    v["name"],
            "style":   v["style"],
            "lang":    v["lang"],
            "speaker": v["speaker"],   # VCTK speaker ID, for attribution
            "size_kb": size_kb,
        })
    out_path = os.path.join(OUTPUT_DIR, "voices.json")
    with open(out_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\n📄 Updated voices.json  →  {os.path.abspath(out_path)}")


if __name__ == "__main__":
    download_and_prep()
