export const DEFAULTS = {
  API_BASE: "https://katara-api.wiccagirl.online",
  ARCGIS_API_KEY: "AAPTxy8BH1VEsoebNVZXo8HurHOzlhyj484tF0siqrlS7D2GGuS3rjAk9WodkMj0EyEcQ4LG8oGshgWB6OQTmYmPZ8WtKOG3u16xMYpOgHB7YumE2F_Cl6GwTBWrgKXLpG-F7bwM8iFd4uUZRtH9oLcoNqITo4J--i_jzIrPuBndEnTteZ0ba6qZj6FSzOv5WKTsoVLl08fPlM_Fzcbn2s899O-GHINpIgFzYSRKpBlmLDY.AT1_7MmbEmco",
};

export function getConfig() {
  const url = new URL(location.href);
  const apiFromQuery = url.searchParams.get("api");
  const storedApi = localStorage.getItem("katara_api_base");
  const apiBase = (apiFromQuery || storedApi || DEFAULTS.API_BASE).replace(/\/$/, "");
  const arc = localStorage.getItem("katara_arcgis_key") || DEFAULTS.ARCGIS_API_KEY;

  return { API_BASE: apiBase, ARCGIS_API_KEY: arc };
}

export function setApiBase(v) {
  localStorage.setItem("katara_api_base", v.replace(/\/$/, ""));
}

export function setArcgisKey(v) {
  localStorage.setItem("katara_arcgis_key", v.trim());
}
