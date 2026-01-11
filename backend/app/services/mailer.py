import os
import requests
from jinja2 import Template

EMAIL_ENDPOINT = "https://api.resend.com/emails"

# Minimal inline-styled layout (mobile-first, force light background)
BASE_TEMPLATE = Template("""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>{{ subject }}</title>
  <style>
    :root { color-scheme: light; }
    html,body { background:#ffffff !important; margin:0; padding:0; -webkit-text-size-adjust:100%; }
    img { border:0; -ms-interpolation-mode:bicubic; display:block; max-width:100%; height:auto; }
    .outer { width:100%; background:#ffffff; padding:18px 10px; }
    .container { max-width:600px; width:100%; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 8px 30px rgba(2,6,23,0.06); }
    .brand { background:#1E2A5A; }
    .brand img { width:100%; height:auto; display:block; }
    .header { padding:16px 18px 0; display:flex; align-items:center; gap:12px; }
    .header .titles { text-align:left; }
    .title-main { font-weight:800; font-size:18px; color:#1E2A5A; line-height:1.2; }
    .subtitle { font-size:12px; color:#475569; }
    .content { padding:16px 18px 6px; text-align:center; }
    h1 { margin:0 0 10px; font-size:18px; color:#0f172a; }
    p { margin:0 0 14px; font-size:14px; line-height:1.6; color:#334155; }
    .code-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:14px; text-align:center; }
    .cta { margin-top:14px; text-align:center; }
    .footer { padding:12px 18px 18px; border-top:1px solid #e2e8f0; font-size:12px; color:#64748b; line-height:1.5; text-align:center; }
    .muted { color:#94a3b8; font-size:11px; margin-top:10px; text-align:center; }
    @media only screen and (max-width:480px) {
      .container { border-radius:12px; }
      .header { padding:12px; }
      .content { padding:12px; }
      h1 { font-size:16px; }
    }
  </style>
</head>
<body style="background:#ffffff;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table class="outer" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff">
    <tr>
      <td align="center">
        <table class="container" width="600" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#ffffff">
          <tr>
            <td class="brand" style="background:#1E2A5A;">
              <img src="https://katara.pages.dev/KataraLM_banner.png" alt="KataraLM banner" style="display:block;width:100%;height:auto;">
            </td>
          </tr>
          <tr>
            <td class="header">
              <img src="https://katara.pages.dev/KataraLM_logo.png" alt="KataraLM" width="44" height="44" style="border-radius:12px;border:1px solid rgba(15,23,42,0.06);">
              <div class="titles">
                <div class="title-main">KataraLM</div>
                <div class="subtitle">Asistente inteligente de reciclaje y sostenibilidad</div>
              </div>
            </td>
          </tr>
          <tr>
            <td class="content">
              <h1>{{ title }}</h1>
              <p>{{ body }}</p>

              {% if code %}
              <div class="code-box">
                <div style="font-size:12px;color:#64748b;margin-bottom:6px;">Tu código es:</div>
                <div style="font-size:28px;letter-spacing:6px;font-weight:900;color:#1E2A5A;font-family:monospace;word-break:break-all;">{{ code }}</div>

                <div style="margin-top:10px;text-align:center;">
                  <button type="button" data-code="{{ code|e }}" onclick="(function(btn){try{navigator.clipboard.writeText(btn.dataset.code);btn.dataset.orig=btn.innerText;btn.innerText='Copiado';btn.style.background='#1E2A5A';btn.style.color='#ffffff';setTimeout(function(){btn.innerText=btn.dataset.orig||'Copiar';btn.style.background='transparent';btn.style.color='#1E2A5A';},2000);}catch(e){btn.innerText='Copiar';}})(this)" style="background:transparent;color:#1E2A5A;border:1px solid rgba(30,42,90,0.08);padding:6px 10px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;transition:all .18s ease;">Copiar</button>
                </div>

                <div style="font-size:12px;color:#64748b;margin-top:10px;text-align:center;">No compartas este código con nadie.</div>
              </div>
              {% endif %}

              {% if cta_url and cta_text %}
              <div class="cta">
                <a href="{{ cta_url }}" style="display:inline-block;background:#1E2A5A;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700;">{{ cta_text }}</a>
              </div>
              {% endif %}
            </td>
          </tr>

          <tr>
            <td>
              <div class="footer">
                <div>¿Necesitas ayuda? Contáctanos: <a href="mailto:{{ contact_email }}" style="color:#1E2A5A;">{{ contact_email }}</a> · <a href="{{ whatsapp_link }}" style="color:#1E2A5A;">WhatsApp</a></div>
                <div style="margin-top:6px;">
                  <a href="{{ terms_url }}" style="color:#1E2A5A;">Términos y Condiciones</a>
                  &nbsp;·&nbsp;
                  <a href="{{ privacy_url }}" style="color:#1E2A5A;">Política de Privacidad</a>
                </div>
                <div style="margin-top:10px;">© {{ year }} el mago. Todos los derechos reservados.</div>
              </div>
            </td>
          </tr>
        </table>

        <div class="muted">Si tú no solicitaste este correo, puedes ignorarlo.</div>
      </td>
    </tr>
  </table>
</body>
</html>
""")

def _render(**kw) -> str:
    return BASE_TEMPLATE.render(**kw)


def _format_sender(resend_from: str) -> str:
    """Ensure the sender name appears as 'KataraLM' while preserving the email address."""
    if not resend_from:
        return "KataraLM <no-reply@katara.local>"
    import re
    m = re.search(r"<([^>]+)>", resend_from)
    if m:
        email = m.group(1).strip()
    else:
        email = resend_from.strip()
    return f"KataraLM <{email}>"

def send_email(resend_api_key: str, resend_from: str, to_email: str, subject: str, html: str) -> None:
    if not resend_api_key:
        return
    from_addr = _format_sender(resend_from)
    payload = {
        "from": from_addr,
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    r = requests.post(
        EMAIL_ENDPOINT,
        headers={
            "Authorization": f"Bearer {resend_api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=20,
    )
    r.raise_for_status()

def send_otp_email(public_base_url: str, resend_api_key: str, resend_from: str, to_email: str, purpose: str, code: str, contact_email: str, whatsapp_link: str, terms_url: str, privacy_url: str) -> None:
    logo_url = f"{public_base_url}/brand/KataraLM_logo.png"
    banner_url = f"{public_base_url}/brand/KataraLM_banner.png"
    year = __import__("datetime").datetime.utcnow().year

    if purpose == "verify_email":
        subject = "Verifica tu correo - KataraLM"
        title = "Verificación de correo"
        body = "Gracias por registrarte. Ingresa este código para verificar tu correo y activar tu cuenta."
        cta_url = terms_url or public_base_url
        cta_text = "Ver términos"
    else:
        subject = "Recuperación de contraseña - KataraLM"
        title = "Recuperación de contraseña"
        body = "Usa este código para restablecer tu contraseña. Si no fuiste tú, ignora este mensaje."
        cta_url = privacy_url or public_base_url
        cta_text = "Ver privacidad"

    html = _render(
        subject=subject,
        title=title,
        body=body,
        code=code,
        cta_url=cta_url,
        cta_text=cta_text,
        logo_url=logo_url,
        banner_url=banner_url,
        contact_email=contact_email,
        whatsapp_link=whatsapp_link,
        terms_url=terms_url or "#",
        privacy_url=privacy_url or "#",
        year=year,
    )
    send_email(resend_api_key, resend_from, to_email, subject, html)
