#!/usr/bin/env python3
"""Control the OmniASR Hugging Face Space hardware.

Usage:
  python3 scripts/hf-omniasr-space.py status
  python3 scripts/hf-omniasr-space.py pause
  python3 scripts/hf-omniasr-space.py resume

The script reads HF_TOKEN/HUGGINGFACE_HUB_TOKEN first, then falls back to the
stored git credential for huggingface.co.
"""

from __future__ import annotations

import os
import subprocess
import sys

try:
    from huggingface_hub import HfApi
except ModuleNotFoundError:
    print("Missing dependency: python3 -m pip install --user huggingface_hub", file=sys.stderr)
    raise


REPO_ID = os.environ.get("OMNIASR_SPACE_REPO", "pablonification/omniasr-transcriptions")
HARDWARE = os.environ.get("OMNIASR_SPACE_HARDWARE", "a100-large")


def get_token() -> str | None:
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_HUB_TOKEN")
    if token:
        return token

    try:
        credentials = subprocess.check_output(
            ["git", "credential", "fill"],
            input=b"protocol=https\nhost=huggingface.co\n\n",
            stderr=subprocess.DEVNULL,
        ).decode()
    except Exception:
        return None

    for line in credentials.splitlines():
        if line.startswith("password="):
            return line.split("=", 1)[1]
    return None


def print_status(api: HfApi) -> None:
    runtime = api.get_space_runtime(repo_id=REPO_ID)
    print(f"repo={REPO_ID}")
    print(f"stage={runtime.stage}")
    print(f"hardware={runtime.hardware}")
    print(f"requested_hardware={runtime.requested_hardware}")


def main() -> int:
    action = sys.argv[1] if len(sys.argv) > 1 else "status"
    token = get_token()
    if not token:
        print("No Hugging Face token found. Set HF_TOKEN or log in with git credentials.", file=sys.stderr)
        return 1

    api = HfApi(token=token)

    if action == "status":
        print_status(api)
        return 0

    if action == "pause":
        api.pause_space(repo_id=REPO_ID)
        print_status(api)
        return 0

    if action == "resume":
        api.request_space_hardware(repo_id=REPO_ID, hardware=HARDWARE)
        api.restart_space(repo_id=REPO_ID)
        print_status(api)
        return 0

    print(f"Unknown action: {action}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
