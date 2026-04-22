#!/usr/bin/env python3
"""
Quick end-to-end image generation test.
Run via:  test_image.bat   or   python scripts/test_image.py
"""
import json
import sys
import time
import urllib.request

BASE   = "http://localhost:8000"
PROMPT = "a futuristic city at sunset, golden light, cinematic"
BODY   = json.dumps({
    "prompt":          PROMPT,
    "negative_prompt": "blurry, low quality",
    "width":           1024,
    "height":          1024,
}).encode()


def get(path):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=5) as r:
        return json.loads(r.read())


def post(path, data):
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())


# 1. Health check
print("Checking backend...", end=" ", flush=True)
try:
    health = get("/health")
    print(f"OK  (tier={health['tier']})")
except Exception as e:
    print(f"FAILED\n\n[ERROR] Backend not responding: {e}")
    print("\nMake sure start.bat is running and the Backend window shows 'Application startup complete'.")
    sys.exit(1)

# 2. Submit job
print(f"Prompt: \"{PROMPT}\"")
print("Submitting image job...", end=" ", flush=True)
try:
    resp = post("/generate/image", BODY)
    job_id = resp["job_id"]
    print(f"OK  (job_id={job_id})")
except Exception as e:
    print(f"FAILED\n\n[ERROR] {e}")
    sys.exit(1)

print("Processing (first run loads FLUX into VRAM — may take a few minutes)", end="", flush=True)
start   = time.time()
dots    = 0

while True:
    time.sleep(5)
    dots += 1
    try:
        job = get(f"/job/{job_id}")
    except Exception:
        print(".", end="", flush=True)
        continue

    status   = job.get("status", "unknown")
    progress = job.get("progress", 0)

    if status == "done":
        elapsed = time.time() - start
        result  = job.get("result_url") or ""
        print(f"\n\nDone in {elapsed:.0f}s")
        if result:
            local = result.replace("/outputs", "backend\\outputs").replace("/", "\\")
            print(f"Output: {local}")
            print(f"URL:    http://localhost:8000{result}")
        else:
            print("(no result_url — check Celery window for errors)")
        break

    elif status == "failed":
        elapsed = time.time() - start
        error   = job.get("error") or "unknown error"
        print(f"\n\n[ERROR] Job failed after {elapsed:.0f}s:\n  {error}")
        print("\nCheck the Celery worker window for the full traceback.")
        sys.exit(1)

    elif time.time() - start > 600:
        print(f"\n\n[TIMEOUT] Job still '{status}' after 10 minutes.")
        print("Check the Celery worker window — it may have crashed.")
        sys.exit(1)

    else:
        # Print progress every 5 dots
        if dots % 5 == 0 and progress:
            print(f" {progress}%", end="", flush=True)
        else:
            print(".", end="", flush=True)
