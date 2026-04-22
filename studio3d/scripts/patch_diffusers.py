import pathlib

path = pathlib.Path(r"G:\Studio3D\studio3d\.venv\Lib\site-packages\diffusers\pipelines\pipeline_loading_utils.py")
content = path.read_text(encoding="utf-8")

old = "from transformers.utils import FLAX_WEIGHTS_NAME as TRANSFORMERS_FLAX_WEIGHTS_NAME"
new = (
    "try:\n"
    "    from transformers.utils import FLAX_WEIGHTS_NAME as TRANSFORMERS_FLAX_WEIGHTS_NAME\n"
    "except ImportError:\n"
    '    TRANSFORMERS_FLAX_WEIGHTS_NAME = "flax_model.msgpack"'
)

if old in content:
    path.write_text(content.replace(old, new), encoding="utf-8")
    print("Patched pipeline_loading_utils.py successfully.")
elif "except ImportError" in content and "TRANSFORMERS_FLAX_WEIGHTS_NAME" in content:
    print("Already patched — nothing to do.")
else:
    print("ERROR: Could not find the import line to patch. Check diffusers version.")
