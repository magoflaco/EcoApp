import os
from dataclasses import dataclass
from datetime import datetime, timezone

def _getenv(name: str, default: str = "") -> str:
    return os.getenv(name, default)

def _getbool(name: str, default: str = "false") -> bool:
    return _getenv(name, default).lower() in ("1","true","yes","y","on")

@dataclass(frozen=True)
class Settings:
    public_base_url: str
    data_dir: str
    db_path: str
    upload_dir: str
    brand_dir: str

    jwt_secret: str
    jwt_issuer: str
    access_token_minutes: int
    refresh_token_days: int
    password_pepper: str

    resend_api_key: str
    resend_from: str
    contact_email: str
    whatsapp_link: str
    terms_url: str
    privacy_url: str

    groq_api_key_chat: str
    groq_api_key_vision: str
    chat_model: str
    vision_model: str

    arcgis_api_key: str
    arcgis_geocode_enable: bool

    cors_allow_origins: list
    admin_api_key: str

    @staticmethod
    def load() -> "Settings":
        data_dir = _getenv("KATARA_DATA_DIR", "./data")
        os.makedirs(data_dir, exist_ok=True)

        upload_dir = os.path.join(data_dir, "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        os.makedirs(os.path.join(upload_dir, "chat"), exist_ok=True)
        os.makedirs(os.path.join(upload_dir, "avatars"), exist_ok=True)

        # static/brand sits next to app/ at project root
        brand_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static", "brand"))

        cors = _getenv("CORS_ALLOW_ORIGINS", "*")
        cors_allow_origins = ["*"] if cors.strip() == "*" else [o.strip() for o in cors.split(",") if o.strip()]

        return Settings(
            public_base_url=_getenv("PUBLIC_BASE_URL", "http://152.67.69.61:6767").rstrip("/"),
            data_dir=data_dir,
            db_path=os.path.join(data_dir, "katara.sqlite3"),
            upload_dir=upload_dir,
            brand_dir=brand_dir,

            jwt_secret=_getenv("JWT_SECRET", "change-me"),
            jwt_issuer=_getenv("JWT_ISSUER", "katara"),
            access_token_minutes=int(_getenv("ACCESS_TOKEN_MINUTES", "30")),
            refresh_token_days=int(_getenv("REFRESH_TOKEN_DAYS", "30")),
            password_pepper=_getenv("PASSWORD_PEPPER", "change-me-too"),

            resend_api_key=_getenv("RESEND_API_KEY", ""),
            resend_from=_getenv("RESEND_FROM", "noreply-katara@wiccagirl.online"),
            contact_email=_getenv("CONTACT_EMAIL", "gchaviano@itb.edu.ec"),
            whatsapp_link=_getenv("WHATSAPP_LINK", ""),
            terms_url=_getenv("TERMS_URL", ""),
            privacy_url=_getenv("PRIVACY_URL", ""),

            groq_api_key_chat=_getenv("GROQ_API_KEY_CHAT", ""),
            groq_api_key_vision=_getenv("GROQ_API_KEY_VISION", ""),
            chat_model=_getenv("CHAT_MODEL", "llama-3.3-70b-versatile"),
            vision_model=_getenv("VISION_MODEL", "llama-4-scout"),

            arcgis_api_key=_getenv("ARCGIS_API_KEY", ""),
            arcgis_geocode_enable=_getbool("ARCGIS_GEOCODE_ENABLE", "false"),

            cors_allow_origins=cors_allow_origins,
            admin_api_key=_getenv("ADMIN_API_KEY", "change-admin"),
        )

    @staticmethod
    def now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()
