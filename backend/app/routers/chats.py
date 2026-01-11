import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

from ..settings import Settings
from ..db import get_conn
from ..utils.tokens import get_current_user_id
from ..utils.files import unique_filename
from ..services.groq import groq_chat, groq_vision

router = APIRouter()

SYSTEM_PROMPT = (
    "Eres Katara, un asistente inteligente de reciclaje y sostenibilidad en Guayaquil, Ecuador. "
    "Hablas en español claro, cercano y práctico. "
    "Nunca menciones modelos, APIs, ni detalles internos. "
    "Si no estás segura, pregunta una aclaración corta y luego sugiere una opción segura."
)

VISION_PROMPT = (
    "Analiza el objeto de la imagen para reciclaje en Guayaquil, Ecuador. "
    "Devuelve SOLO un JSON con estas claves: "
    "{material, categoria, reciclable, como_preparar, riesgos, recomendacion, palabras_clave}. "
    "reciclable debe ser true/false. 'categoria' puede ser: plastico, metal, vidrio, papel, organico, electronico, peligroso, otro."
)

class ChatOut(BaseModel):
    id: int
    title: str

class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    image_url: Optional[str] = None
    created_at: str

def _utcnow():
    return datetime.now(timezone.utc).isoformat()

def _ensure_default_chat(conn, user_id: int) -> int:
    row = conn.execute("SELECT id FROM chats WHERE user_id=? ORDER BY id LIMIT 1", (user_id,)).fetchone()
    if row:
        return int(row["id"])
    now = _utcnow()
    conn.execute("INSERT INTO chats(user_id,title,created_at,updated_at) VALUES(?,?,?,?)", (user_id, "Katara", now, now))
    conn.commit()
    return int(conn.execute("SELECT id FROM chats WHERE user_id=? ORDER BY id LIMIT 1", (user_id,)).fetchone()["id"])

@router.get("", response_model=list[ChatOut])
def list_chats(user_id: int = Depends(get_current_user_id)):
    s = Settings.load()
    conn = get_conn(s)
    rows = conn.execute("SELECT id,title FROM chats WHERE user_id=? ORDER BY updated_at DESC", (user_id,)).fetchall()
    if not rows:
        _ensure_default_chat(conn, user_id)
        rows = conn.execute("SELECT id,title FROM chats WHERE user_id=? ORDER BY updated_at DESC", (user_id,)).fetchall()
    conn.close()
    return [ChatOut(id=r["id"], title=r["title"]) for r in rows]

@router.post("")
def create_chat(title: str = Form("Katara"), user_id: int = Depends(get_current_user_id)):
    s = Settings.load()
    conn = get_conn(s)
    now = _utcnow()
    conn.execute("INSERT INTO chats(user_id,title,created_at,updated_at) VALUES(?,?,?,?)", (user_id, title, now, now))
    conn.commit()
    chat_id = int(conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"])
    conn.close()
    return {"ok": True, "chat_id": chat_id}

@router.get("/{chat_id}/messages", response_model=list[MessageOut])
def get_messages(chat_id: int, user_id: int = Depends(get_current_user_id)):
    s = Settings.load()
    conn = get_conn(s)
    owns = conn.execute("SELECT 1 FROM chats WHERE id=? AND user_id=?", (chat_id, user_id)).fetchone()
    if not owns:
        conn.close()
        raise HTTPException(status_code=404, detail="Chat no encontrado.")
    rows = conn.execute("SELECT id,role,content,image_path,created_at FROM messages WHERE chat_id=? ORDER BY id ASC", (chat_id,)).fetchall()
    conn.close()
    out=[]
    for r in rows:
        img=None
        if r["image_path"]:
            img = f"{s.public_base_url}/uploads/chat/{os.path.basename(r['image_path'])}"
        out.append(MessageOut(id=r["id"], role=r["role"], content=r["content"], image_url=img, created_at=r["created_at"]))
    return out

@router.post("/{chat_id}/messages")
async def send_message(
    chat_id: int,
    text: str = Form(""),
    lat: Optional[float] = Form(None),
    lon: Optional[float] = Form(None),
    image: Optional[UploadFile] = File(None),
    user_id: int = Depends(get_current_user_id),
):
    s = Settings.load()
    conn = get_conn(s)
    owns = conn.execute("SELECT 1 FROM chats WHERE id=? AND user_id=?", (chat_id, user_id)).fetchone()
    if not owns:
        conn.close()
        raise HTTPException(status_code=404, detail="Chat no encontrado.")

    image_path = None
    vision_json = None

    if image is not None:
        content = await image.read()
        if len(content) > 10 * 1024 * 1024:
            conn.close()
            raise HTTPException(status_code=413, detail="Imagen demasiado grande (máx 10MB).")
        fname = unique_filename(f"chat_{chat_id}_{user_id}", image.filename or "image.jpg")
        image_path = os.path.join(s.upload_dir, "chat", fname)
        with open(image_path, "wb") as f:
            f.write(content)
        try:
            vision_json = groq_vision(
                api_key=s.groq_api_key_vision,
                model=s.vision_model,
                prompt=VISION_PROMPT,
                image_bytes=content,
                mime=image.content_type or "image/jpeg",
            )
        except Exception:
            vision_json = '{"error":"vision_failed"}'

    conn.execute(
        "INSERT INTO messages(chat_id,role,content,image_path,created_at) VALUES(?,?,?,?,?)",
        (chat_id, "user", text or "(imagen)", image_path, _utcnow()),
    )
    conn.execute("UPDATE chats SET updated_at=? WHERE id=?", (_utcnow(), chat_id))
    conn.commit()

    # Build context from last 20 messages
    rows = conn.execute("SELECT role,content FROM messages WHERE chat_id=? ORDER BY id DESC LIMIT 20", (chat_id,)).fetchall()
    history = list(reversed(rows))

    messages = [{"role":"system","content":SYSTEM_PROMPT}]
    if vision_json:
        messages.append({"role":"system","content":f"Contexto interno (análisis JSON): {vision_json}"})
    if lat is not None and lon is not None:
        messages.append({"role":"system","content":f"Ubicación aproximada del usuario: lat={lat}, lon={lon}."})

    for r in history:
        if r["role"] in ("user","assistant"):
            messages.append({"role": r["role"], "content": r["content"]})

    if not text and vision_json:
        messages.append({"role":"user","content":"¿Qué es esto y cómo debo desecharlo o reciclarlo en Guayaquil?"})

    reply = groq_chat(s.groq_api_key_chat, s.chat_model, messages)

    conn.execute("INSERT INTO messages(chat_id,role,content,image_path,created_at) VALUES(?,?,?,?,?)", (chat_id, "assistant", reply, None, _utcnow()))
    conn.execute("UPDATE chats SET updated_at=? WHERE id=?", (_utcnow(), chat_id))
    conn.commit()
    conn.close()

    return {
        "ok": True,
        "reply": reply,
        "image_url": f"{s.public_base_url}/uploads/chat/{os.path.basename(image_path)}" if image_path else None,
    }

@router.post("/default/message")
async def default_message(
    text: str = Form(""),
    lat: Optional[float] = Form(None),
    lon: Optional[float] = Form(None),
    image: Optional[UploadFile] = File(None),
    user_id: int = Depends(get_current_user_id),
):
    s = Settings.load()
    conn = get_conn(s)
    chat_id = _ensure_default_chat(conn, user_id)
    conn.close()
    # reuse route logic by calling send_message
    return await send_message(chat_id=chat_id, text=text, lat=lat, lon=lon, image=image, user_id=user_id)

@router.get("/default/history")
def default_history(user_id: int = Depends(get_current_user_id)):
    s = Settings.load()
    conn = get_conn(s)
    chat_id = _ensure_default_chat(conn, user_id)
    rows = conn.execute("SELECT id,role,content,image_path,created_at FROM messages WHERE chat_id=? ORDER BY id ASC", (chat_id,)).fetchall()
    conn.close()
    out=[]
    for r in rows:
        img=None
        if r["image_path"]:
            img = f"{s.public_base_url}/uploads/chat/{os.path.basename(r['image_path'])}"
        out.append({"id":r["id"],"role":r["role"],"content":r["content"],"image_url":img,"created_at":r["created_at"]})
    return out
