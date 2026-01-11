import hashlib
import secrets
from datetime import datetime, timedelta, timezone

def generate_code() -> str:
    return f"{secrets.randbelow(1000000):06d}"

def code_hash(email: str, purpose: str, code: str, pepper: str) -> str:
    raw = f"{email.lower()}|{purpose}|{code}|{pepper}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()

def expires_in(minutes: int = 10) -> str:
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()
