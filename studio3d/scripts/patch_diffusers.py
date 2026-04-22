import pathlib
import sys

path = pathlib.Path(r"G:\Studio3D\studio3d\.venv\Lib\site-packages\diffusers\pipelines\pipeline_loading_utils.py")

if not path.exists():
    print(f"ERROR: File not found: {path}")
    sys.exit(1)

content = path.read_text(encoding="utf-8")

old = "from transformers.utils import FLAX_WEIGHTS_NAME as TRANSFORMERS_FLAX_WEIGHTS_NAME"

new = """try:
    from transformers.utils import FLAX_WEIGHTS_NAME as TRANSFORMERS_FLAX_WEIGHTS_NAME
except ImportError:
    TRANSFORMERS_FLAX_WEIGHTS_NAME = "flax_model.msgpack"
"""

# Strip any previously broken patch (literal \n characters) and retry
broken = (
    "try:\\n"
    "    from transformers.utils import FLAX_WEIGHTS_NAME as TRANSFORMERS_FLAX_WEIGHTS_NAME\\n"
    "except ImportError:\\n"
    '    TRANSFORMERS_FLAX_WEIGHTS_NAME = "flax_model.msgpack"'
)

if broken in content:
    print("Found broken patch (literal \\n) — reverting to original line first...")
    content = content.replace(broken, old)

if old in content:
    patched = content.replace(old, new.rstrip("\n"))
    path.write_text(patched, encoding="utf-8")
    print("Patched pipeline_loading_utils.py successfully.")
elif "except ImportError" in content and "TRANSFORMERS_FLAX_WEIGHTS_NAME" in content:
    print("Already patched correctly — nothing to do.")
else:
    print("ERROR: Could not find the import line to patch. Check diffusers version.")
    # Show lines around where it would be to help diagnose
    for i, line in enumerate(content.splitlines(), 1):
        if "FLAX_WEIGHTS_NAME" in line or "transformers.utils" in line:
            print(f"  Line {i}: {line}")
