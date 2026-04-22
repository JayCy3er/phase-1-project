#!/usr/bin/env python3
"""
Patches diffusers 0.32.2 pipeline_loading_utils.py to handle the removal of
FLAX_WEIGHTS_NAME from transformers 5.x.

Run once after setup:
    python scripts\patch_diffusers.py

The in-process shim in tasks.py/main.py is the primary fix; this script
patches the venv file as a belt-and-suspenders fallback.
"""
import pathlib
import sys

PATH = pathlib.Path(
    r"G:\Studio3D\studio3d\.venv\Lib\site-packages\diffusers\pipelines\pipeline_loading_utils.py"
)

TARGET = "from transformers.utils import FLAX_WEIGHTS_NAME as TRANSFORMERS_FLAX_WEIGHTS_NAME"

GOOD_BLOCK = (
    "try:\n"
    "    from transformers.utils import FLAX_WEIGHTS_NAME as TRANSFORMERS_FLAX_WEIGHTS_NAME\n"
    "except ImportError:\n"
    '    TRANSFORMERS_FLAX_WEIGHTS_NAME = "flax_model.msgpack"'
)

if not PATH.exists():
    print(f"ERROR: File not found:\n  {PATH}")
    sys.exit(1)

content = PATH.read_text(encoding="utf-8")

# Verify current syntax
def has_good_syntax(text):
    try:
        compile(text, str(PATH), "exec")
        return True
    except SyntaxError:
        return False

# Already correct?
if TARGET not in content and "TRANSFORMERS_FLAX_WEIGHTS_NAME" in content and has_good_syntax(content):
    print("Already patched correctly and syntax is valid — nothing to do.")
    sys.exit(0)

# Rebuild the file line-by-line so we handle any broken prior patch
lines  = content.splitlines()
output = []
i      = 0
done   = False

while i < len(lines):
    line     = lines[i]
    stripped = line.strip()

    # The target line at module level (unpatched)
    if stripped == TARGET and not line.startswith(" "):
        output.append(GOOD_BLOCK)
        i += 1
        done = True
        continue

    # A broken try: block that wraps our target — skip the whole broken block
    if stripped == "try:" and i + 1 < len(lines) and TARGET in lines[i + 1]:
        output.append(GOOD_BLOCK)
        # Skip: try:, the import line, except ImportError:, the fallback line
        i += 1                          # skip try:
        while i < len(lines):
            s = lines[i].strip()
            if s == TARGET or s.startswith("except") or s.startswith("TRANSFORMERS_FLAX"):
                i += 1
            else:
                break
        done = True
        continue

    output.append(line)
    i += 1

if not done:
    print("ERROR: Could not find the target line to patch.")
    print("Lines containing FLAX_WEIGHTS_NAME:")
    for idx, l in enumerate(lines, 1):
        if "FLAX_WEIGHTS_NAME" in l:
            print(f"  Line {idx}: {l!r}")
    sys.exit(1)

new_content = "\n".join(output)

if not has_good_syntax(new_content):
    print("ERROR: Patch produced invalid Python syntax — file NOT modified.")
    print("Context around patch point:")
    for idx, l in enumerate(new_content.splitlines(), 1):
        if 45 <= idx <= 58:
            print(f"  Line {idx}: {l!r}")
    sys.exit(1)

PATH.write_text(new_content, encoding="utf-8")
print("Patched pipeline_loading_utils.py successfully.")
print("  Syntax verified OK.")
