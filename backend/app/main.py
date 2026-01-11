import os
from dotenv import load_dotenv
import uvicorn
from app.server import create_app

load_dotenv()

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "6767"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
