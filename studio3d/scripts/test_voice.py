#!/usr/bin/env python3
"""
Quick end-to-end voice generation test.
Run via:  test.bat   or   python scripts/test_voice.py
"""
import json
import sys
import time
import urllib.request
import urllib.error

BASE = "http://localhost:8000"
TEXT = "Hello from Studio3D. Voice generation is working."
BODY = json.dumps({
    "text":     TEXT,
    "voice_id": "narrator",
    "emotion":  0.5,
    "speed":    1.0,
    "language": "en",
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
print("Submitting voice job...", end=" ", flush=True)
try:
    resp = post("/generate/voice", BODY)
    job_id = resp["job_id"]
    print(f"OK  (job_id={job_id})")
except Exception as e:
    print(f"FAILED\n\n[ERROR] {e}")
    sys.exit(1)

# 3. Poll until done
print("Processing", end="", flush=True)
start = time.time()
while True:
    time.sleep(3)
    try:
        job = get(f"/job/{job_id}")
    except Exception:
        print(".", end="", flush=True)
        continue

    status = job.get("status", "unknown")

    if status == "done":
        elapsed = time.time() - start
        result  = job.get("result_url") or ""
        print(f"\n\nDone in {elapsed:.0f}s")
        if result:
            # result_url is a relative path like /outputs/voice/abc.wav
            # map it to the local file
            local = result.replace("/outputs", "backend\\outputs").replace("/", "\\")
            print(f"Output: {local}")
            print(f"URL:    http://localhost:8000{result}")
        else:
            print("(no result_url in response — check Celery window for errors)")
        break

    elif status == "failed":
        elapsed = time.time() - start
        error   = job.get("error") or "unknown error"
        print(f"\n\n[ERROR] Job failed after {elapsed:.0f}s: {error}")
        print("\nCheck the Celery worker window for the full traceback.")
        sys.exit(1)

    elif time.time() - start > 300:
        print(f"\n\n[TIMEOUT] Job still '{status}' after 5 minutes.")
        print("Check the Celery worker window — it may have crashed.")
        sys.exit(1)

    else:
        print(".", end="", flush=True)
