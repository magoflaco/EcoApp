import json
import os
from datetime import datetime, timezone
from .settings import Settings
from .db import get_conn

def seed_if_empty(s: Settings):
    conn = get_conn(s)
    count = conn.execute("SELECT COUNT(1) AS c FROM points").fetchone()["c"]
    if int(count) == 0:
        _seed(conn, s)
    conn.close()

def _seed(conn, s: Settings):
    points_path = os.path.join(os.path.dirname(__file__), "seed_points.json")
    with open(points_path, "r", encoding="utf-8") as f:
        points = json.load(f)
    now = datetime.now(timezone.utc).isoformat()
    for p in points:
        conn.execute(
            "INSERT INTO points(name,address,lat,lon,category,notes,source_url,updated_at) VALUES(?,?,?,?,?,?,?,?)",
            (p["name"], p["address"], p.get("lat"), p.get("lon"), p["category"], p.get("notes",""), p.get("source_url",""), now),
        )
    conn.commit()

def seed():
    s = Settings.load()
    conn = get_conn(s)
    conn.execute("DELETE FROM points")
    conn.commit()
    _seed(conn, s)
    conn.close()
    print("Seeded points.")

if __name__ == "__main__":
    seed()
