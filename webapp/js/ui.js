export function el(tag, attrs={}, children=[]){
  const n = document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k === "class") n.className = v;
    else if(k === "html") n.innerHTML = v;
    else if(k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if(v !== undefined && v !== null) n.setAttribute(k, String(v));
  }
  for(const c of (Array.isArray(children) ? children : [children])){
    if(c === null || c === undefined) continue;
    n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return n;
}

export function toast(msg, ms=2800){
  let t = document.querySelector(".toast");
  if(!t){
    t = el("div", {class:"toast"});
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), ms);
}

export function mdToHtml(md){
  // marked + DOMPurify loaded via CDN
  const raw = window.marked.parse(md || "", { mangle:false, headerIds:false });
  const clean = window.DOMPurify.sanitize(raw, {ALLOWED_ATTR:["href","target","rel","src","alt","class"]});
  // Force safe link behavior + blue clickable text
  const wrap = document.createElement("div");
  wrap.innerHTML = clean;
  wrap.querySelectorAll("a").forEach(a=>{
    a.setAttribute("target","_blank");
    a.setAttribute("rel","noopener noreferrer");
  });
  return wrap.innerHTML;
}

export function showImageModal(src){
  let back = document.querySelector(".modalBackdrop");
  if(!back){
    back = el("div", {class:"modalBackdrop", onclick:(e)=>{ if(e.target===back) back.classList.remove("show"); }});
    const modal = el("div", {class:"modal"});
    const img = el("img", {src:"", alt:"preview"});
    img.addEventListener("click", ()=> back.classList.remove("show"));
    modal.appendChild(img);
    back.appendChild(modal);
    document.body.appendChild(back);
  }
  back.querySelector("img").src = src;
  back.classList.add("show");
}

export function fmtTime(iso){
  try{
    const d = new Date(iso);
    return d.toLocaleString(undefined, {hour:"2-digit", minute:"2-digit"});
  }catch{ return ""; }
}
