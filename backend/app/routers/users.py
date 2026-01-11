import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, EmailStr, Field

from ..settings import Settings
from ..db import get_conn
from ..utils.tokens import get_current_user_id
from ..utils.passwords import verify_password, hash_password
from ..utils.files import unique_filename

router = APIRouter()

class MeOut(BaseModel):
    id: int
    email: EmailStr
    username: str
    bio: str
    avatar_url: Optional[str] = None
    is_verified: bool

@router.get("/me", response_model=MeOut)
def me(user_id: int = Depends(get_current_user_id)):
    s = Settings.load()
    conn = get_conn(s)
    row = conn.execute("SELECT id,email,username,bio,avatar_path,is_verified FROM users WHERE id=?", (user_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    avatar_url = None
    if row["avatar_path"]:
        avatar_url = f"{s.public_base_url}/uploads/avatars/{os.path.basename(row['avatar_path'])}"
    return MeOut(
        id=row["id"], email=row["email"], username=row["username"], bio=row["bio"],
        avatar_url=avatar_url, is_verified=bool(row["is_verified"])
    )

@router.patch("/me")
def update_me(
    username: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    avatar: Optional[UploadFile] = File(None),
    user_id: int = Depends(get_current_user_id),
):
    s = Settings.load()
    conn = get_conn(s)

    if username:
        # uniqueness
        if conn.execute("SELECT 1 FROM users WHERE username=? AND id<>?", (username, user_id)).fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="Username ya está en uso.")

    avatar_path = None
    if avatar is not None:
        content = avatar.file.read()
        if len(content) > 8 * 1024 * 1024:
            conn.close()
            raise HTTPException(status_code=413, detail="Avatar demasiado grande (máx 8MB).")
        fname = unique_filename(f"avatar_{user_id}", avatar.filename or "avatar.jpg")
        avatar_path = os.path.join(s.upload_dir, "avatars", fname)
        with open(avatar_path, "wb") as f:
            f.write(content)

    now = datetime.now(timezone.utc).isoformat()
    if username is not None and bio is not None and avatar_path is not None:
        conn.execute("UPDATE users SET username=?, bio=?, avatar_path=?, updated_at=? WHERE id=?", (username, bio, avatar_path, now, user_id))
    else:
        if username is not None:
            conn.execute("UPDATE users SET username=?, updated_at=? WHERE id=?", (username, now, user_id))
        if bio is not None:
            conn.execute("UPDATE users SET bio=?, updated_at=? WHERE id=?", (bio, now, user_id))
        if avatar_path is not None:
            conn.execute("UPDATE users SET avatar_path=?, updated_at=? WHERE id=?", (avatar_path, now, user_id))

    conn.commit()
    conn.close()
    return {"ok": True}

class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)

@router.post("/me/change-password")
def change_password(body: ChangePasswordIn, user_id: int = Depends(get_current_user_id)):
    s = Settings.load()
    conn = get_conn(s)
    row = conn.execute("SELECT password_hash FROM users WHERE id=?", (user_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    if not verify_password(body.current_password, s.password_pepper, row["password_hash"]):
        conn.close()
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta.")
    new_hash = hash_password(body.new_password, s.password_pepper)
    conn.execute("UPDATE users SET password_hash=?, updated_at=? WHERE id=?", (new_hash, datetime.now(timezone.utc).isoformat(), user_id))
    conn.commit()
    conn.close()
    return {"ok": True}
