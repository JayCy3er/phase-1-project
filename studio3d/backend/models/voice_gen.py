"""
Voice synthesis via Chatterbox TTS (always local, even in cloud mode).

Lazy-loads on first call and keeps the model in memory.

Windows/DirectML: Chatterbox does not natively support the DirectML backend,
so we pass "cpu" when DirectML is the system default. Voice models are small
enough that CPU inference is acceptable (~10s for a 5s clip).
"""
import os
import torch
import torchaudio as ta
from pathlib import Path

from ._device import device_str, is_directml

_model_cache: dict = {}


def _patch_perth():
    """resemble-perth's C extension sometimes fails to bind on Windows,
    leaving PerthImplicitWatermarker as None. Replace with a no-op so
    chatterbox loads without crashing."""
    try:
        import perth
        if perth.PerthImplicitWatermarker is None:
            class _NoOp:
                def apply_watermark(self, audio, sample_rate=None):
                    return audio
            perth.PerthImplicitWatermarker = _NoOp
    except ImportError:
        pass


def _chatterbox_device() -> str:
    """
    Return device string for Chatterbox.
    Falls back to CPU on DirectML — chatterbox's CUDA kernels won't run on DX12.
    """
    if is_directml():
        return "cpu"
    d = device_str()
    # Chatterbox only understands "cuda", "cpu", "mps"
    if d.startswith("cuda") or d in ("cpu", "mps"):
        return d
    return "cpu"


def _get_model(engine: str = "turbo"):
    """
    engine: "original" | "multilingual" | "turbo"
    Turbo is default — fastest, paralinguistic tag support.
    """
    cache_key = f"chatterbox_{engine}"
    if cache_key in _model_cache:
        return _model_cache[cache_key]

    _patch_perth()
    device = _chatterbox_device()
    print(f"[Chatterbox] Loading {engine} model on {device}...")

    if engine == "turbo":
        from chatterbox.tts_turbo import ChatterboxTurboTTS
        model = ChatterboxTurboTTS.from_pretrained(device=device)
    elif engine == "multilingual":
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        model = ChatterboxMultilingualTTS.from_pretrained(device=device)
    else:
        from chatterbox.tts import ChatterboxTTS
        model = ChatterboxTTS.from_pretrained(device=device)

    _model_cache[cache_key] = model
    print(f"[Chatterbox] {engine} model loaded and cached.")
    return model


def generate_voice(
    text:              str,
    voice_ref_path:    str   = None,
    output_path:       str   = "/tmp/output.wav",
    emotion_intensity: float = 0.5,
    speed:             float = 1.0,
    language:          str   = "en",
    engine:            str   = "turbo",
) -> str:
    """
    Generate speech with Chatterbox TTS.

    Args:
        text:              Text to speak. Turbo supports [laugh], [cough], [chuckle].
        voice_ref_path:    Path to 5-10s WAV reference for voice cloning.
        output_path:       Where to save the output WAV.
        emotion_intensity: 0.0 = neutral, 1.0 = very dramatic.
        speed:             Speech rate multiplier (0.5 = slow, 1.5 = fast).
        language:          Language code for multilingual engine (e.g. "fr", "zh").
        engine:            "turbo" | "original" | "multilingual"

    Returns:
        Path to the saved WAV file.
    """
    os.environ.setdefault("HSA_OVERRIDE_GFX_VERSION", "11.0.0")

    if language != "en" and engine != "multilingual":
        engine = "multilingual"

    model = _get_model(engine)

    print(f"[Chatterbox] Generating — engine={engine}  lang={language}  "
          f"emotion={emotion_intensity:.2f}  speed={speed:.2f}")
    if voice_ref_path:
        print(f"[Chatterbox] Voice cloning from: {voice_ref_path}")

    # Map emotion_intensity (0–1) → exaggeration param (0.25–2.0)
    exaggeration = 0.25 + emotion_intensity * 1.75

    # Map speed (0.5–1.5) → cfg_weight (0.3–0.7)
    cfg_weight = 0.7 - (speed - 0.5) * 0.2

    with torch.inference_mode():
        if engine == "multilingual":
            wav = model.generate(
                text,
                audio_prompt_path = voice_ref_path,
                language_id       = language,
                exaggeration      = exaggeration,
                cfg_weight        = cfg_weight,
            )
        else:
            wav = model.generate(
                text,
                audio_prompt_path = voice_ref_path,
                exaggeration      = exaggeration,
                cfg_weight        = cfg_weight,
            )

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    ta.save(output_path, wav, model.sr)
    print(f"[Chatterbox] Saved WAV to {output_path}  ({wav.shape[-1] / model.sr:.1f}s)")
    return output_path
