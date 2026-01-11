import { getConfig } from "./config.js";

function getTokens(){
  return {
    access: localStorage.getItem("katara_access") || "",
    refresh: localStorage.getItem("katara_refresh") || "",
  };
}
function setTokens({access_token, refresh_token}){
  if(access_token) localStorage.setItem("katara_access", access_token);
  if(refresh_token) localStorage.setItem("katara_refresh", refresh_token);
}
function clearTokens(){
  localStorage.removeItem("katara_access");
  localStorage.removeItem("katara_refresh");
}

export function isAuthed(){
  return !!localStorage.getItem("katara_access");
}

export async function apiFetch(path, opts={}){
  const { API_BASE } = getConfig();
  const url = API_BASE + path;
  const method = opts.method || "GET";
  const headers = new Headers(opts.headers || {});
  const auth = opts.auth !== false;
  const isForm = opts.body instanceof FormData;
  if(!isForm && !headers.has("Content-Type") && opts.body && typeof opts.body === "object"){
    headers.set("Content-Type","application/json");
  }
  if(auth){
    const { access } = getTokens();
    if(access) headers.set("Authorization","Bearer " + access);
  }
  const body = (!opts.body || isForm) ? opts.body : (typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body));

  const res = await fetch(url, { method, headers, body });
  if(res.status !== 401){
    return res;
  }

  // Try refresh once
  const { refresh } = getTokens();
  if(!refresh || opts._retried) return res;

  const ok = await refreshAccess(refresh);
  if(!ok) return res;

  return apiFetch(path, {...opts, _retried:true});
}

async function refreshAccess(refresh){
  try{
    const { API_BASE } = getConfig();
    const r = await fetch(API_BASE + "/auth/refresh", {
      method:"POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({refresh_token: refresh}),
    });
    const j = await r.json().catch(()=>null);
    if(r.ok && j?.ok){
      setTokens(j);
      return true;
    }
  }catch(_){}
  clearTokens();
  return false;
}

export async function json(res){
  const t = await res.text();
  try { return JSON.parse(t); } catch { return { raw: t }; }
}

export function logout(){
  clearTokens();
  location.hash = "#/auth";
}
