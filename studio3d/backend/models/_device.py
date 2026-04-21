"""
Shared device detection for all Studio3D model modules.

Priority: DirectML (Windows AMD/Intel/NVIDIA via DX12) → CUDA (Linux ROCm/NVIDIA) → CPU
"""
import torch

_device = None


def get_device():
    """Return the best available torch device object."""
    global _device
    if _device is not None:
        return _device

    try:
        import torch_directml
        _device = torch_directml.device(0)
        print(f"[Device] DirectML GPU: {_device}")
        return _device
    except (ImportError, Exception):
        pass

    if torch.cuda.is_available():
        _device = "cuda"
        print("[Device] CUDA GPU")
        return _device

    _device = "cpu"
    print("[Device] CPU (no GPU backend found)")
    return _device


def device_str() -> str:
    """Device as a plain string — needed by APIs that don't accept device objects."""
    return str(get_device())


def is_directml() -> bool:
    try:
        import torch_directml  # noqa: F401
        return "privateuseone" in device_str()
    except ImportError:
        return False


def safe_dtype(preferred=torch.bfloat16) -> torch.dtype:
    """
    DirectML doesn't support bfloat16 — fall back to float16.
    CPU falls back to float32.
    """
    d = device_str()
    if "cpu" in d:
        return torch.float32
    if is_directml():
        return torch.float16
    return preferred
