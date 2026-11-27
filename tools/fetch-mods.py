#!/usr/bin/env python3
"""Download the exact mod files listed in mods.lock.json and verify them.

Usage: python3 tools/fetch-mods.py
Files that are already present and correct are skipped. Nothing is deleted.
"""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def sha512(data):
    return hashlib.sha512(data).hexdigest()


failed = []
for entry in json.loads((ROOT / "tools" / "mods.lock.json").read_text()):
    target = ROOT / entry["path"]
    if target.exists():
        if sha512(target.read_bytes()) != entry["sha512"]:
            failed.append(f"{entry['path']}: existing file differs; move it aside and rerun")
        continue
    try:
        request = urllib.request.Request(entry["url"], headers={"User-Agent": "fetch-mods"})
        with urllib.request.urlopen(request, timeout=300) as response:
            data = response.read()
        if sha512(data) != entry["sha512"]:
            raise ValueError("checksum mismatch")
    except (OSError, ValueError) as error:
        failed.append(f"{entry['path']}: {error}")
        continue
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    print("downloaded", entry["path"])

if failed:
    print("\nFAILED:\n" + "\n".join(failed), file=sys.stderr)
    sys.exit(1)
print("All listed files are present and verified.")
