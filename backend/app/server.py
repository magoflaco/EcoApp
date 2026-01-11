import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .settings import Settings
from .db import init_db, get_conn
from .routers import auth, users, chats, points, contact, legal
from .seed import seed_if_empty

def create_app() -> FastAPI:
    s = Settings.load()
    init_db(s)
    seed_if_empty(s)

    app = FastAPI(title="KataraLM API", version="2.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Uploads (avatars + chat images)
    os.makedirs(s.upload_dir, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=s.upload_dir), name="uploads")

    # Brand assets for email and UI
    if os.path.isdir(s.brand_dir):
        app.mount("/brand", StaticFiles(directory=s.brand_dir), name="brand")

    @app.get("/health")
    def health():
        return {"ok": True}

    app.include_router(auth.router, prefix="/auth", tags=["auth"])
    app.include_router(users.router, tags=["users"])
    app.include_router(chats.router, prefix="/chats", tags=["chats"])
    app.include_router(points.router, prefix="/points", tags=["points"])
    app.include_router(contact.router, tags=["contact"])
    app.include_router(legal.router, tags=["legal"])

    return app
