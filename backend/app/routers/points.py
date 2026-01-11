from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from ..settings import Settings
from ..db import get_conn
from ..utils.tokens import get_current_user_id
from ..services.arcgis import geocode_single_line

router = APIRouter()

@router.get("")
def list_points(user_id: int = Depends(get_current_user_id)):
    s = Settings.load()
    conn = get_conn(s)
    rows = conn.execute("SELECT id,name,address,lat,lon,category,notes,source_url FROM points ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def _haversine_km(lat1, lon1, lat2, lon2):
    import math
    R=6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2-lat1)
    dl = math.radians(lon2-lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(a))

@router.get("/nearest")
def nearest(lat: float = Query(...), lon: float = Query(...), k: int = 10, user_id: int = Depends(get_current_user_id)):
    s = Settings.load()
    conn = get_conn(s)
    rows = conn.execute("SELECT id,name,address,lat,lon,category,notes,source_url FROM points").fetchall()
    conn.close()

    scored=[]
    for r in rows:
        if r["lat"] is None or r["lon"] is None:
            d=1e9
        else:
            d=_haversine_km(lat, lon, r["lat"], r["lon"])
        item=dict(r)
        item["distance_km"] = None if d>=1e8 else round(d,2)
        # route link: keep as URL (frontend may open externally)
        addr_q = __import__("urllib.parse").parse.quote(item["address"])
        item["search_url"] = "https://www.openstreetmap.org/search?query=" + addr_q
        if item.get("lat") is not None and item.get("lon") is not None:
            item["directions_url"] = f"https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route={lat},{lon};{item['lat']},{item['lon']}"
        else:
            item["directions_url"] = item["search_url"]
        scored.append((d,item))
    scored.sort(key=lambda x:x[0])
    return [it for _,it in scored[:k]]

@router.post("/geocode-missing")
def geocode_missing(admin_key: str = Query(..., description="ADMIN_API_KEY"), user_id: int = Depends(get_current_user_id)):
    s = Settings.load()
    if admin_key != s.admin_api_key:
        return {"ok": False, "error": "Forbidden"}
    if not s.arcgis_geocode_enable:
        return {"ok": False, "error": "ARCGIS_GEOCODE_ENABLE=false"}
    conn = get_conn(s)
    rows = conn.execute("SELECT id,address FROM points WHERE lat IS NULL OR lon IS NULL").fetchall()
    updated=0
    for r in rows:
        lat, lon = geocode_single_line(r["address"] + ", Guayaquil, Ecuador", s.arcgis_api_key)
        if lat is not None and lon is not None:
            conn.execute("UPDATE points SET lat=?, lon=?, updated_at=? WHERE id=?", (float(lat), float(lon), datetime.now(timezone.utc).isoformat(), r["id"]))
            updated += 1
    conn.commit()
    conn.close()
    return {"ok": True, "updated": updated}

@router.get("/map-config")
def map_config():
    s = Settings.load()
    # Frontend can use this to initialize ArcGIS maps without Google.
    return {
        "provider": "arcgis",
        "apiKey": s.arcgis_api_key[:6] + "..." if s.arcgis_api_key else "",
        "basemapUrl": "https://basemaps-api.arcgis.com/arcgis/rest/services/styles/ArcGIS:Streets?type=style",
        "tiles": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    }
