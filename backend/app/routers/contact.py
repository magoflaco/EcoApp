from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel, EmailStr
import requests

from ..settings import Settings
from ..db import get_conn
from ..services.mailer import send_email, _render

router = APIRouter()

class ContactIn(BaseModel):
    email: EmailStr | None = None
    message: str

@router.post("/contact")
def contact(body: ContactIn):
    s = Settings.load()
    conn = get_conn(s)
    conn.execute("INSERT INTO contacts(email,message,created_at) VALUES(?,?,?)", (body.email, body.message, datetime.now(timezone.utc).isoformat()))
    conn.commit()
    conn.close()

    # Send to team with a clean HTML email (best effort)
    if s.resend_api_key and s.contact_email:
        subject = "Nuevo mensaje de contacto - KataraLM"
        html = _render(
            subject=subject,
            title="Mensaje de contacto",
            body=f"Correo: {body.email or 'anónimo'}<br><br>{body.message}",
            code=None,
            cta_url=s.public_base_url,
            cta_text="Abrir KataraLM",
            logo_url=f"{s.public_base_url}/brand/KataraLM_logo.png",
            banner_url=f"{s.public_base_url}/brand/KataraLM_banner.png",
            contact_email=s.contact_email,
            whatsapp_link=s.whatsapp_link,
            terms_url=s.terms_url or "#",
            privacy_url=s.privacy_url or "#",
            year=datetime.now(timezone.utc).year,
        )
        try:
            send_email(s.resend_api_key, s.resend_from, s.contact_email, subject, html)
        except Exception:
            pass

    return {"ok": True, "whatsapp": s.whatsapp_link}
