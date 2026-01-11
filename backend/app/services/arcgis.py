import requests

GEOCODE_URL = "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates"

def geocode_single_line(address: str, api_key: str, max_locations: int = 1):
    if not api_key:
        return None, None
    params = {
        "f": "json",
        "singleLine": address,
        "maxLocations": max_locations,
        "outFields": "Match_addr,Addr_type",
        "token": api_key,
    }
    r = requests.get(GEOCODE_URL, params=params, timeout=25)
    r.raise_for_status()
    data = r.json()
    cands = data.get("candidates") or []
    if not cands:
        return None, None
    loc = cands[0].get("location") or {}
    # ArcGIS returns x=lon, y=lat
    return loc.get("y"), loc.get("x")
