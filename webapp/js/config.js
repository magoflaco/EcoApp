export const DEFAULTS = {
  API_BASE: "https://katara-api.wiccagirl.online",
  ARCGIS_API_KEY: "",
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
