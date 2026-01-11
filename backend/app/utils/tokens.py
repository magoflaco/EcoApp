import hashlib
import jwt
from typing import Optional
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from ..settings import Settings
from ..db import get_conn

bearer = HTTPBearer(auto_error=False)

def _utcnow():
    return datetime.now(timezone.utc)

def make_access_token(s: Settings, user_id: int) -> str:
    exp = _utcnow() + timedelta(minutes=s.access_token_minutes)
    payload = {"sub": str(user_id), "iss": s.jwt_issuer, "exp": exp}
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256")

def make_refresh_token(s: Settings, user_id: int) -> str:
    exp = _utcnow() + timedelta(days=s.refresh_token_days)
    payload = {"sub": str(user_id), "iss": s.jwt_issuer, "exp": exp, "typ": "refresh"}
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256")

def refresh_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def store_refresh(s: Settings, token: str, user_id: int, expires_at: str, conn: Optional[object] = None):
    owns_conn = conn is None
    if owns_conn:
        conn = get_conn(s)
    conn.execute(
        "INSERT OR REPLACE INTO refresh_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)",
        (refresh_hash(token), user_id, expires_at),
    )
    conn.commit()
    if owns_conn:
        conn.close()


def revoke_refresh(s: Settings, token: str, conn: Optional[object] = None):
    owns_conn = conn is None
    if owns_conn:
        conn = get_conn(s)
    conn.execute("DELETE FROM refresh_tokens WHERE token_hash=?", (refresh_hash(token),))
    conn.commit()
    if owns_conn:
        conn.close()


def verify_access_token(s: Settings, token: str) -> int:
    try:
        payload = jwt.decode(token, s.jwt_secret, algorithms=["HS256"], options={"require": ["exp"]})
        return int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

def verify_refresh(s: Settings, token: str) -> int:
    try:
        payload = jwt.decode(token, s.jwt_secret, algorithms=["HS256"], options={"require": ["exp"]})
        if payload.get("typ") != "refresh":
            raise ValueError("not refresh")
        user_id = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    conn = get_conn(s)
    row = conn.execute("SELECT token_hash FROM refresh_tokens WHERE token_hash=?", (refresh_hash(token),)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=401, detail="Refresh token revoked")
    return user_id

# ---- FastAPI dependency ----

def get_settings() -> Settings:
    return Settings.load()

def get_current_user_id(
    s: Settings = Depends(get_settings),
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> int:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return verify_access_token(s, creds.credentials)
