import os
import re
from datetime import datetime, timezone

SAFE = re.compile(r"[^a-zA-Z0-9._-]+")

def safe_name(name: str) -> str:
    name = name or "file"
    name = SAFE.sub("_", name)
    return name[:120]

def unique_filename(prefix: str, original: str) -> str:
    base = safe_name(original)
    ts = int(datetime.now(timezone.utc).timestamp())
    return f"{prefix}_{ts}_{base}"
