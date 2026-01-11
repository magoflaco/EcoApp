from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field

from ..settings import Settings
from ..db import get_conn
from ..utils.passwords import hash_password, verify_password
from ..utils.otp import generate_code, code_hash, expires_in
from ..utils.tokens import make_access_token, make_refresh_token, store_refresh, revoke_refresh, verify_refresh
from ..services.mailer import send_otp_email

router = APIRouter()

class RegisterIn(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8, max_length=128)
    bio: str | None = ""

class VerifyEmailIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class ResendVerifyIn(BaseModel):
    email: EmailStr

@router.post("/resend-verification")
def resend_verification(body: ResendVerifyIn):
    s = Settings.load()
    conn = get_conn(s)
    user = conn.execute("SELECT is_verified FROM users WHERE email=?", (body.email.lower(),)).fetchone()
    if not user:
        conn.close()
        return {"ok": True}
    if int(user["is_verified"]) == 1:
        conn.close()
        return {"ok": True, "message": "Tu correo ya está verificado."}

    code = generate_code()
    ch = code_hash(body.email, "verify_email", code, s.password_pepper)
    exp = expires_in(10)
    now = _utcnow().isoformat()

    conn.execute("DELETE FROM email_otps WHERE email=? AND purpose=?", (body.email.lower(), "verify_email"))
    conn.execute(
        "INSERT INTO email_otps(email,purpose,code_hash,expires_at,attempts,created_at) VALUES(?,?,?,?,?,?)",
        (body.email.lower(), "verify_email", ch, exp, 0, now),
    )
    conn.commit()
    conn.close()

    send_otp_email(
        public_base_url=s.public_base_url,
        resend_api_key=s.resend_api_key,
        resend_from=s.resend_from,
        to_email=body.email,
        purpose="verify_email",
        code=code,
        contact_email=s.contact_email,
        whatsapp_link=s.whatsapp_link,
        terms_url=s.terms_url,
        privacy_url=s.privacy_url,
    )
    return {"ok": True}

class LoginIn(BaseModel):
    identifier: str
    password: str

class RefreshIn(BaseModel):
    refresh_token: str

class ForgotIn(BaseModel):
    email: EmailStr

class ResetIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=128)

def _utcnow():
    return datetime.now(timezone.utc)

@router.post("/register")
def register(body: RegisterIn):
    s = Settings.load()
    conn = get_conn(s)
    # Enforce uniqueness
    if conn.execute("SELECT 1 FROM users WHERE email=?", (body.email.lower(),)).fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="El correo ya está registrado.")
    if conn.execute("SELECT 1 FROM users WHERE username=?", (body.username,)).fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="El username ya está en uso.")

    now = _utcnow().isoformat()
    pw_hash = hash_password(body.password, s.password_pepper)
    conn.execute(
        "INSERT INTO users(email,username,password_hash,bio,avatar_path,is_verified,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
        (body.email.lower(), body.username, pw_hash, body.bio or "", None, 0, now, now),
    )
    conn.commit()

    # Create verification OTP
    code = generate_code()
    ch = code_hash(body.email, "verify_email", code, s.password_pepper)
    exp = expires_in(10)
    conn.execute("DELETE FROM email_otps WHERE email=? AND purpose=?", (body.email.lower(), "verify_email"))
    conn.execute(
        "INSERT INTO email_otps(email,purpose,code_hash,expires_at,attempts,created_at) VALUES(?,?,?,?,?,?)",
        (body.email.lower(), "verify_email", ch, exp, 0, now),
    )
    conn.commit()
    conn.close()

    send_otp_email(
        public_base_url=s.public_base_url,
        resend_api_key=s.resend_api_key,
        resend_from=s.resend_from,
        to_email=body.email,
        purpose="verify_email",
        code=code,
        contact_email=s.contact_email,
        whatsapp_link=s.whatsapp_link,
        terms_url=s.terms_url,
        privacy_url=s.privacy_url,
    )
    return {"ok": True, "message": "Te enviamos un código para verificar tu correo."}

@router.post("/verify-email")
def verify_email(body: VerifyEmailIn):
    s = Settings.load()
    conn = get_conn(s)
    row = conn.execute(
        "SELECT id,code_hash,expires_at,attempts FROM email_otps WHERE email=? AND purpose=? ORDER BY id DESC LIMIT 1",
        (body.email.lower(), "verify_email"),
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=400, detail="Código inválido.")
    if datetime.fromisoformat(row["expires_at"]) < _utcnow():
        conn.close()
        raise HTTPException(status_code=400, detail="Código expirado.")
    if int(row["attempts"]) >= 8:
        conn.close()
        raise HTTPException(status_code=429, detail="Demasiados intentos. Solicita un nuevo código.")

    expected = code_hash(body.email, "verify_email", body.code, s.password_pepper)
    if expected != row["code_hash"]:
        conn.execute("UPDATE email_otps SET attempts=attempts+1 WHERE id=?", (row["id"],))
        conn.commit()
        conn.close()
        raise HTTPException(status_code=400, detail="Código inválido.")

    # mark verified
    conn.execute("UPDATE users SET is_verified=1, updated_at=? WHERE email=?", (_utcnow().isoformat(), body.email.lower()))
    conn.execute("DELETE FROM email_otps WHERE id=?", (row["id"],))
    # issue tokens
    user = conn.execute("SELECT id FROM users WHERE email=?", (body.email.lower(),)).fetchone()
    user_id = int(user["id"])
    access = make_access_token(s, user_id)
    refresh = make_refresh_token(s, user_id)
    exp = (_utcnow() + timedelta(days=s.refresh_token_days)).isoformat()
    store_refresh(s, refresh, user_id, exp, conn=conn)
    conn.commit()
    conn.close()
    return {"ok": True, "access_token": access, "refresh_token": refresh}

@router.post("/login")
def login(body: LoginIn):
    s = Settings.load()
    conn = get_conn(s)
    ident = body.identifier.strip().lower()
    user = conn.execute(
        "SELECT id,email,username,password_hash,is_verified FROM users WHERE lower(email)=? OR lower(username)=?",
        (ident, ident),
    ).fetchone()

    if not user:
        conn.close()
        raise HTTPException(status_code=401, detail="Credenciales inválidas.")
    if int(user["is_verified"]) != 1:
        conn.close()
        raise HTTPException(status_code=403, detail="Tu correo aún no está verificado.")
    if not verify_password(body.password, s.password_pepper, user["password_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Credenciales inválidas.")

    user_id = int(user["id"])
    access = make_access_token(s, user_id)
    refresh = make_refresh_token(s, user_id)
    exp = (_utcnow() + timedelta(days=s.refresh_token_days)).isoformat()
    store_refresh(s, refresh, user_id, exp, conn=conn)
    conn.close()
    return {"ok": True, "access_token": access, "refresh_token": refresh}

@router.post("/refresh")
def refresh(body: RefreshIn):
    s = Settings.load()
    user_id = verify_refresh(s, body.refresh_token)
    revoke_refresh(s, body.refresh_token)
    access = make_access_token(s, user_id)
    refresh_token = make_refresh_token(s, user_id)
    exp = (_utcnow() + timedelta(days=s.refresh_token_days)).isoformat()
    store_refresh(s, refresh_token, user_id, exp)
    return {"ok": True, "access_token": access, "refresh_token": refresh_token}

@router.post("/forgot-password")
def forgot(body: ForgotIn):
    s = Settings.load()
    conn = get_conn(s)
    user = conn.execute("SELECT id FROM users WHERE email=?", (body.email.lower(),)).fetchone()

    # Always return ok to prevent enumeration
    if not user:
        conn.close()
        return {"ok": True}

    code = generate_code()
    ch = code_hash(body.email, "reset_password", code, s.password_pepper)
    exp = expires_in(10)
    now = _utcnow().isoformat()

    conn.execute("DELETE FROM email_otps WHERE email=? AND purpose=?", (body.email.lower(), "reset_password"))
    conn.execute(
        "INSERT INTO email_otps(email,purpose,code_hash,expires_at,attempts,created_at) VALUES(?,?,?,?,?,?)",
        (body.email.lower(), "reset_password", ch, exp, 0, now),
    )
    conn.commit()
    conn.close()

    send_otp_email(
        public_base_url=s.public_base_url,
        resend_api_key=s.resend_api_key,
        resend_from=s.resend_from,
        to_email=body.email,
        purpose="reset_password",
        code=code,
        contact_email=s.contact_email,
        whatsapp_link=s.whatsapp_link,
        terms_url=s.terms_url,
        privacy_url=s.privacy_url,
    )
    return {"ok": True}

@router.post("/reset-password")
def reset(body: ResetIn):
    s = Settings.load()
    conn = get_conn(s)
    row = conn.execute(
        "SELECT id,code_hash,expires_at,attempts FROM email_otps WHERE email=? AND purpose=? ORDER BY id DESC LIMIT 1",
        (body.email.lower(), "reset_password"),
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=400, detail="Código inválido.")
    if datetime.fromisoformat(row["expires_at"]) < _utcnow():
        conn.close()
        raise HTTPException(status_code=400, detail="Código expirado.")
    if int(row["attempts"]) >= 8:
        conn.close()
        raise HTTPException(status_code=429, detail="Demasiados intentos.")

    expected = code_hash(body.email, "reset_password", body.code, s.password_pepper)
    if expected != row["code_hash"]:
        conn.execute("UPDATE email_otps SET attempts=attempts+1 WHERE id=?", (row["id"],))
        conn.commit()
        conn.close()
        raise HTTPException(status_code=400, detail="Código inválido.")

    new_hash = hash_password(body.new_password, s.password_pepper)
    conn.execute("UPDATE users SET password_hash=?, updated_at=? WHERE email=?", (new_hash, _utcnow().isoformat(), body.email.lower()))
    conn.execute("DELETE FROM email_otps WHERE id=?", (row["id"],))
    conn.commit()
    conn.close()
    return {"ok": True}
