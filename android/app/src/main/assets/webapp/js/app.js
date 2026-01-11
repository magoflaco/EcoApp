import { getConfig, setApiBase, setArcgisKey } from "./config.js";
import { apiFetch, json, isAuthed, logout } from "./api.js";
import { el, toast, mdToHtml, showImageModal, fmtTime } from "./ui.js";

const ICONS = {
  chat: "./assets/home.svg",
  recognition: "./assets/hojaverde.svg",
  points: "./assets/search.svg",
  profile: "./assets/profile.svg",
  settings: "./assets/settings.svg",
  about: "./assets/bigicon.svg",
};

const state = {
  me: null,
  chats: [],
  currentChatId: null,
  messages: new Map(), // chatId -> messages[]
  points: [],
  map: null,
  markers: [],
  pointsLoaded: false,
  geocodeCache: new Map(),
};

function root() {
  return document.getElementById("app");
}

function route() {
  const h = location.hash || "";
  const r = h.replace(/^#\/?/, "/");
  return (r === "" || r === "/") ? "/" : r;
}

window.addEventListener("hashchange", render);
window.addEventListener("load", () => { render(); });

async function render() {
  const r = route();
  const authed = isAuthed();

  if (!authed && r !== "/auth") {
    location.hash = "#/auth";
    return;
  }
  if (authed && r === "/auth") {
    location.hash = "#/";
    return;
  }

  root().innerHTML = "";
  if (r === "/auth") {
    root().appendChild(AuthPage());
    return;
  }

  await ensureMe();
  root().appendChild(AppShell(r));
}

function Topbar() {
  const cfg = getConfig();
  return el("div", { class: "topbar" }, [
    el("div", { class: "topbarInner" }, [
      el("div", { class: "brandRow" }, [
        el("img", { src: "./assets/KataraLM_logo.png", alt: "KataraLM" }),
        el("div", {}, [
          el("div", { class: "brandTitle" }, "Katara"),
          el("div", { class: "brandSub" }, "Reciclaje y sostenibilidad · Guayaquil")
        ])
      ]),
    ])
  ]);
}

function Sidebar(active) {
  const items = [
    ["/chat", "Chat", "Habla con Katara", ICONS.chat],
    ["/recognition", "Reconocimiento", "Foto + respuesta", ICONS.recognition],
    ["/points", "Puntos", "Mapa + lista", ICONS.points],
    ["/profile", "Perfil", "Tu cuenta", ICONS.profile],
    ["/settings", "Ajustes", "Preferencias", ICONS.settings],
    ["/about", "About", "Créditos", ICONS.about],
  ];

  return el("div", { class: "sidebar" }, [
    el("div", { class: "brandRow" }, [
      el("a", { href: "#/", style: "display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit;" }, [
        el("img", { src: "./assets/KataraLM_logo.png", alt: "logo" }),
        el("div", {}, [
          el("div", { class: "brandTitle" }, "KataraLM"),
          el("div", { class: "brandSub" }, state.me ? (state.me.username) : "")
        ])
      ])
    ]),
    el("div", { class: "hr" }),
    ...items.map(([path, label, desc, icon]) => (
      el("a", { href: "#" + path, class: "navItem " + (active === path ? "active" : "") }, [
        el("img", { src: icon, alt: "" }),
        el("div", {}, [
          el("div", { class: "navLabel" }, label),
          // Desc hidden by CSS but kept in DOM
          el("div", { class: "navDesc" }, desc),
        ])
      ])
    )),
    el("div", { class: "hr" }),
    el("button", { class: "btn secondary", onclick: () => { logout(); } }, "Cerrar sesión"),
  ]);
}

function MobileNav(active) {
  const items = [
    ["/chat", "Chat", ICONS.chat],
    ["/recognition", "Scan", ICONS.recognition],
    ["/points", "Puntos", ICONS.points],
    ["/profile", "Perfil", ICONS.profile],
    ["/settings", "Ajustes", ICONS.settings],
    ["/about", "About", ICONS.about],
  ];
  return el("div", { class: "mobileNav" }, [
    el("div", { class: "mobileNavGrid" }, items.map(([path, label, icon]) => (
      el("a", { href: "#" + path, class: (active === path ? "active" : "") }, [
        el("img", { src: icon, alt: "" }),
        el("div", {}, label),
      ])
    )))
  ]);
}

function AppShell(active) {
  const wrap = el("div", {}, [
    Topbar(),
    el("div", { class: "shell" }, [
      Sidebar(active),
      el("div", { class: "" }, [
        Page(active),
      ])
    ]),
    MobileNav(active),
  ]);
  return wrap;
}

function Page(path) {
  if (path === "/" || path === "/dashboard") return DashboardPage();
  if (path === "/chat") return ChatPage();
  if (path === "/recognition") return RecognitionPage();
  if (path === "/points") return PointsPage();
  if (path === "/profile") return ProfilePage();
  if (path === "/settings") return SettingsPage();
  if (path === "/about") return AboutPage();
  return el("div", { class: "container" }, [
    el("div", { class: "card pad" }, "Ruta no encontrada.")
  ]);
}

function DashboardPage() {
  const me = state.me || {};
  return el("div", { class: "card pad-lg", style: "height:100%;overflow-y:auto;" }, [
    el("div", { style: "max-width:800px;margin:0 auto;width:100%;" }, [
      // Hero / Welcome
      el("div", { style: "text-align:center;margin-bottom:40px;padding:20px 0;" }, [
        el("img", {
          src: "./assets/bigicon.svg",
          style: "height:80px; margin-bottom:16px; display:block; margin-left:auto; margin-right:auto;",
          alt: "Logo"
        }),
        el("h1", { style: "color:var(--navy);margin:0 0 10px;font-size:2rem;" }, `¡Hola, ${me.username || "Usuario"}!`),
        el("div", { style: "color:var(--text-muted);font-size:1.1rem;max-width:600px;margin:0 auto;" },
          "Bienvenido a KataraLM. Tu asistente inteligente para el reciclaje y la sostenibilidad en Guayaquil."
        )
      ]),

      // Quick Actions Grid
      el("div", { style: "display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:20px;margin-bottom:40px;" }, [

        // Chat Card
        el("a", { href: "#/chat", class: "card", style: "padding:24px;text-decoration:none;transition:transform 0.2s;display:block;border:1px solid rgba(0,0,0,0.05);" }, [
          el("div", { style: "display:flex;align-items:center;gap:12px;margin-bottom:12px;" }, [
            el("div", { style: "background:var(--primary-light);padding:10px;border-radius:12px;" }, [
              el("img", { src: ICONS.chat, style: "width:24px;height:24px;" })
            ]),
            el("div", { style: "font-weight:700;color:var(--navy);font-size:1.1rem;" }, "Chat Asistente")
          ]),
          el("div", { style: "color:var(--text-muted);line-height:1.5;" }, "Conversa con Katara para resolver tus dudas sobre reciclaje.")
        ]),

        // Recognition Card
        el("a", { href: "#/recognition", class: "card", style: "padding:24px;text-decoration:none;transition:transform 0.2s;display:block;border:1px solid rgba(0,0,0,0.05);" }, [
          el("div", { style: "display:flex;align-items:center;gap:12px;margin-bottom:12px;" }, [
            el("div", { style: "background:#e8fdf5;padding:10px;border-radius:12px;" }, [ // Custom light green bg
              el("img", { src: ICONS.recognition, style: "width:24px;height:24px;" })
            ]),
            el("div", { style: "font-weight:700;color:var(--navy);font-size:1.1rem;" }, "Reconocimiento")
          ]),
          el("div", { style: "color:var(--text-muted);line-height:1.5;" }, "Toma una foto a un residuo e identifica cómo reciclarlo.")
        ]),

        // Points Card
        el("a", { href: "#/points", class: "card", style: "padding:24px;text-decoration:none;transition:transform 0.2s;display:block;border:1px solid rgba(0,0,0,0.05);" }, [
          el("div", { style: "display:flex;align-items:center;gap:12px;margin-bottom:12px;" }, [
            el("div", { style: "background:#fff4e6;padding:10px;border-radius:12px;" }, [ // Custom light orange bg
              el("img", { src: ICONS.points, style: "width:24px;height:24px;" })
            ]),
            el("div", { style: "font-weight:700;color:var(--navy);font-size:1.1rem;" }, "Puntos de Acopio")
          ]),
          el("div", { style: "color:var(--text-muted);line-height:1.5;" }, "Encuentra los puntos de reciclaje más cercanos a ti.")
        ])
      ]),

      // Info / About Section
      // Info / About Section
      el("div", { class: "card", style: "padding:32px;background:linear-gradient(135deg, var(--navy) 0%, #2a3b7d 100%);color:white;overflow:hidden;" }, [
        el("div", { style: "display:flex;gap:30px;align-items:center;flex-wrap:wrap;position:relative;" }, [
          el("div", { style: "flex:1;min-width:280px;z-index:2;" }, [
            el("h3", { style: "margin:0 0 16px;font-size:1.5rem;color:#fff;" }, "¿Cómo funciona?"),
            el("p", { style: "margin:0 0 16px;opacity:0.95;line-height:1.6;font-size:1.05rem;" }, "KataraLM utiliza inteligencia artificial avanzada para ayudarte a gestionar tus residuos de manera responsable."),
            el("ul", { style: "margin:0;padding-left:20px;opacity:0.95;line-height:1.6;font-size:1rem;" }, [
              el("li", { style: "margin-bottom:8px;" }, "Identificación precisa de materiales con visión computarizada."),
              el("li", { style: "margin-bottom:8px;" }, "Base de datos de puntos de acopio actualizada."),
              el("li", {}, "Asistencia personalizada en tiempo real.")
            ])
          ])
        ])
      ])
    ])
  ]);
}

/* -------------------- AUTH -------------------- */

function AuthPage() {
  const wrap = el("div", {}, [
    Topbar(),
    el("div", { class: "authWrap" }, [
      el("div", { class: "card" }, [
        el("div", { class: "banner" }, [el("img", { src: "./assets/KataraLM_banner.png", alt: "banner" })]),
        el("div", { class: "pad-lg" }, [
          el("div", { class: "brandRow" }, [
            el("img", { src: "./assets/KataraLM_logo.png", alt: "logo" }),
            el("div", {}, [
              el("div", { class: "brandTitle" }, "KataraLM"),
              el("div", { class: "brandSub" }, "Inicia sesión o crea tu cuenta")
            ])
          ]),
          el("div", { class: "hr" }),
          AuthTabs()
        ])
      ]),
      el("div", { class: "card pad-lg" }, [
        /* Badge removed */
        el("h2", { style: "margin:10px 0 6px;color:var(--navy);" }, "¿Qué puedes hacer?"),
        el("div", { class: "smallHelp" }, [
          "• Identificar residuos con foto.", el("br"),
          "• Aprender a reciclar en Guayaquil.", el("br"),
          "• Ver puntos de acopio en mapa y lista.", el("br"),
          "• Chatear con Katara sin complicaciones."
        ]),
        /* Technical note removed */
      ])
    ])
  ]);
  return wrap;
}

function AuthTabs() {
  let mode = "login"; // login | register | verify | forgot | reset
  const box = el("div", {});

  const tabs = el("div", { class: "tabs" }, [
    tab("login", "Entrar"),
    tab("register", "Crear cuenta"),
    tab("forgot", "Recuperar"),
  ]);

  function tab(k, label) {
    const b = el("button", { class: "tab " + (mode === k ? "active" : ""), onclick: () => setMode(k) }, label);
    return b;
  }

  function setMode(m) {
    mode = m;
    tabs.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    const map = { login: 0, register: 1, forgot: 2 };
    tabs.children[map[m]]?.classList.add("active");
    draw();
  }

  let carryEmail = "";
  let carryIdentifier = "";
  function draw() {
    box.innerHTML = "";
    if (mode === "login") box.appendChild(LoginForm());
    if (mode === "register") box.appendChild(RegisterForm());
    if (mode === "verify") box.appendChild(VerifyForm());
    if (mode === "forgot") box.appendChild(ForgotForm());
    if (mode === "reset") box.appendChild(ResetForm());
  }

  function LoginForm() {
    const identifier = el("input", { class: "input", placeholder: "email o username", value: carryIdentifier });
    const password = el("input", { class: "input", type: "password", placeholder: "contraseña" });
    const btn = el("button", {
      class: "btn", onclick: async () => {
        btn.disabled = true; btn.textContent = "Entrando...";
        const r = await apiFetch("/auth/login", { method: "POST", auth: false, body: { identifier: identifier.value, password: password.value } });
        const j = await json(r);
        btn.disabled = false; btn.textContent = "Entrar";
        if (!r.ok || !j.ok) { toast(j.detail || "No se pudo entrar."); return; }
        localStorage.setItem("katara_access", j.access_token);
        localStorage.setItem("katara_refresh", j.refresh_token);
        location.hash = "#/";
      }
    }, "Entrar");

    return el("div", { class: "row" }, [
      el("div", {}, [el("div", { class: "label" }, "Usuario"), identifier]),
      el("div", {}, [el("div", { class: "label" }, "Contraseña"), password]),
      el("div", { class: "row2" }, [
        btn,
        el("button", { class: "btn secondary", onclick: () => { setMode("forgot"); } }, "Olvidé mi contraseña")
      ]),
      el("div", { class: "smallHelp" }, "Si tu correo no está verificado, primero crea tu cuenta y verifica el código.")
    ]);
  }

  function RegisterForm() {
    const email = el("input", { class: "input", placeholder: "correo@ejemplo.com" });
    const username = el("input", { class: "input", placeholder: "username" });
    const password = el("input", { class: "input", type: "password", placeholder: "contraseña (min 8)" });
    const bio = el("textarea", { class: "textarea", placeholder: "Biografía (opcional)" });
    const btn = el("button", {
      class: "btn", onclick: async () => {
        btn.disabled = true; btn.textContent = "Creando...";
        const r = await apiFetch("/auth/register", { method: "POST", auth: false, body: { email: email.value, username: username.value, password: password.value, bio: bio.value } });
        const j = await json(r);
        btn.disabled = false; btn.textContent = "Crear cuenta";
        if (!r.ok || !j.ok) { toast(j.detail || "No se pudo registrar."); return; }
        carryEmail = email.value;
        toast("Te enviamos un código. Verifica tu correo.");
        mode = "verify"; draw();
      }
    }, "Crear cuenta");
    return el("div", { class: "row" }, [
      el("div", {}, [el("div", { class: "label" }, "Correo"), email]),
      el("div", {}, [el("div", { class: "label" }, "Username"), username]),
      el("div", {}, [el("div", { class: "label" }, "Contraseña"), password]),
      el("div", {}, [el("div", { class: "label" }, "Bio"), bio]),
      btn,
      el("div", { class: "smallHelp" }, "Al registrarte, recibirás un código OTP para verificar el correo. Luego podrás iniciar sesión con tu contraseña.")
    ]);
  }

  function VerifyForm() {
    const email = el("input", { class: "input", placeholder: "correo", value: carryEmail });
    const code = el("input", { class: "input", placeholder: "000000", inputmode: "numeric", maxlength: "6" });
    const btn = el("button", {
      class: "btn", onclick: async () => {
        btn.disabled = true; btn.textContent = "Verificando...";
        const r = await apiFetch("/auth/verify-email", { method: "POST", auth: false, body: { email: email.value, code: code.value } });
        const j = await json(r);
        btn.disabled = false; btn.textContent = "Verificar";
        if (!r.ok || !j.ok) { toast(j.detail || "Código inválido."); return; }
        localStorage.setItem("katara_access", j.access_token);
        localStorage.setItem("katara_refresh", j.refresh_token);
        toast("Listo. ¡Bienvenido!");
        location.hash = "#/";
      }
    }, "Verificar");

    return el("div", { class: "row" }, [
      el("div", { class: "badge" }, "Verificación de correo"),
      el("div", {}, [el("div", { class: "label" }, "Correo"), email]),
      el("div", {}, [el("div", { class: "label" }, "Código"), code]),
      el("div", { class: "row2" }, [
        btn,
        el("button", { class: "btn secondary", onclick: () => setMode("login") }, "Volver")
      ]),
      el("div", { class: "smallHelp" }, "No compartas el código con nadie.")
    ]);
  }

  function ForgotForm() {
    const email = el("input", { class: "input", placeholder: "correo@ejemplo.com" });
    const btn = el("button", {
      class: "btn", onclick: async () => {
        btn.disabled = true; btn.textContent = "Enviando...";
        const r = await apiFetch("/auth/forgot-password", { method: "POST", auth: false, body: { email: email.value } });
        await json(r);
        btn.disabled = false; btn.textContent = "Enviar código";
        carryEmail = email.value;
        toast("Si el correo existe, te enviamos un código.");
        mode = "reset"; draw();
      }
    }, "Enviar código");
    return el("div", { class: "row" }, [
      el("div", {}, [el("div", { class: "label" }, "Correo"), email]),
      btn,
      el("div", { class: "smallHelp" }, "Te enviaremos un código OTP para restablecer tu contraseña.")
    ]);
  }

  function ResetForm() {
    const email = el("input", { class: "input", placeholder: "correo", value: carryEmail });
    const code = el("input", { class: "input", placeholder: "000000", inputmode: "numeric", maxlength: "6" });
    const np = el("input", { class: "input", type: "password", placeholder: "Nueva contraseña" });
    const btn = el("button", {
      class: "btn", onclick: async () => {
        btn.disabled = true; btn.textContent = "Restableciendo...";
        const r = await apiFetch("/auth/reset-password", { method: "POST", auth: false, body: { email: email.value, code: code.value, new_password: np.value } });
        const j = await json(r);
        btn.disabled = false; btn.textContent = "Cambiar contraseña";
        if (!r.ok || !j.ok) { toast(j.detail || "No se pudo cambiar."); return; }
        toast("Contraseña actualizada. Ahora entra.");
        mode = "login"; draw();
      }
    }, "Cambiar contraseña");
    return el("div", { class: "row" }, [
      el("div", { class: "badge" }, "Recuperación de contraseña"),
      el("div", {}, [el("div", { class: "label" }, "Correo"), email]),
      el("div", {}, [el("div", { class: "label" }, "Código"), code]),
      el("div", {}, [el("div", { class: "label" }, "Nueva contraseña"), np]),
      el("div", { class: "row2" }, [
        btn,
        el("button", { class: "btn secondary", onclick: () => setMode("login") }, "Volver")
      ]),
    ]);
  }

  draw();
  return el("div", {}, [tabs, el("div", { style: "height:12px" }), box]);
}

/* -------------------- DATA LOADERS -------------------- */

async function ensureMe() {
  if (state.me) return state.me;
  const r = await apiFetch("/me");
  if (!r.ok) {
    logout();
    return null;
  }
  state.me = await json(r);
  return state.me;
}

async function loadChats() {
  if (state.chats.length) return state.chats;
  const r = await apiFetch("/chats");
  const j = await json(r);
  if (!r.ok) { toast("No se pudieron cargar los chats."); return []; }
  state.chats = j || [];
  if (!state.currentChatId && state.chats[0]) state.currentChatId = state.chats[0].id;
  return state.chats;
}

async function loadMessages(chatId) {
  if (state.messages.has(chatId)) return state.messages.get(chatId);
  const r = await apiFetch(`/chats/${chatId}/messages`);
  const j = await json(r);
  if (!r.ok) { toast("No se pudieron cargar mensajes."); return []; }
  state.messages.set(chatId, j || []);
  return j || [];
}

/* -------------------- CHAT PAGE -------------------- */

function ChatPage() {
  const page = el("div", { class: "card", style: "height:100%;overflow:hidden;display:flex;flex-direction:column;" }, [
    el("div", { class: "split" }, [
      el("div", { class: "chatList" }, [
        el("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:10px;" }, [
          el("div", {}, [
            el("div", { style: "font-weight:1000;color:var(--navy);" }, "Chats"),
            el("div", { class: "smallHelp" }, "Tu historial con Katara")
          ]),
          el("button", {
            class: "btn small", onclick: async () => {
              const title = prompt("Nombre del chat:", "Nuevo chat");
              if (!title) return;
              const fd = new FormData(); fd.append("title", title);
              const r = await apiFetch("/chats", { method: "POST", body: fd });
              const j = await json(r);
              if (!r.ok || !j.ok) { toast("No se pudo crear."); return; }
              state.chats = []; state.messages.clear();
              await loadChats();
              state.currentChatId = j.chat_id;
              render();
            }
          }, "＋")
        ]),
        el("div", { class: "hr" }),
        el("div", { id: "chatListItems" })
      ]),
      el("div", { class: "chatPane" }, [
        el("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid rgba(0,0,0,0.05);" }, [
          el("div", {}, [
            el("div", { style: "font-weight:700;color:var(--navy);" }, "Chat con Katara"),
            el("div", { class: "smallHelp" }, "Puedes enviar texto, foto y ubicación.")
          ]),
          el("div", { class: "badge" }, state.me?.is_verified ? "Verificado" : "Sin verificar")
        ]),
        el("div", { class: "chatMsgs", id: "chatMsgs" }, [
          el("div", { style: "text-align:center;padding:20px;color:var(--text-muted);font-size:0.9em;" }, "Este es el comienzo de tu chat con Katara.")
        ]),
        el("div", { class: "composer" }, [
          el("div", { class: "composerRow" }, [
            el("textarea", { class: "textarea grow", id: "chatText", placeholder: "Escribe aquí…", rows: "1", style: "min-height:48px;" })
          ]),
          el("div", { class: "composerActions" }, [
            el("div", { style: "display:flex;gap:8px;align-items:center;" }, [
              // Hidden file input
              el("input", {
                type: "file", id: "chatFile", accept: "image/*", capture: "environment", class: "hidden", onchange: (e) => {
                  const l = document.getElementById("fileLabel");
                  const f = e.target.files[0];
                  if (f) { l.classList.add("active"); l.innerHTML = `<span style="color:var(--primary)">📷</span> Foto lista`; }
                  else { l.classList.remove("active"); l.innerHTML = "📷 Foto"; }
                }
              }),
              // Custom Label Button
              el("label", { for: "chatFile", id: "fileLabel", class: "btn secondary small", style: "cursor:pointer;display:flex;align-items:center;gap:6px;" }, "📷 Foto"),

              el("button", {
                class: "btn secondary small", onclick: async () => {
                  if (!navigator.geolocation) { toast("Tu navegador no soporta ubicación."); return; }
                  toast("Pidiendo ubicación…");
                  navigator.geolocation.getCurrentPosition(
                    pos => {
                      state._lastLat = pos.coords.latitude;
                      state._lastLon = pos.coords.longitude;
                      toast("Ubicación lista (se enviará con el próximo mensaje).");
                    },
                    () => toast("No se pudo obtener ubicación."),
                    { enableHighAccuracy: true, timeout: 8000 }
                  );
                }
              }, "📍 Ubicación")
            ]),
            el("button", { class: "btn small", id: "sendBtn", onclick: () => sendChatMessage() }, "Enviar")
          ]),
        ])
      ])
    ])
  ]);

  // Hydrate async
  (async () => {
    await loadChats();
    drawChatList();
    await drawMessages();
  })();

  async function sendChatMessage() {
    const chatId = state.currentChatId;
    if (!chatId) { toast("No hay chat."); return; }
    const text = page.querySelector("#chatText").value.trim();
    const file = page.querySelector("#chatFile").files[0] || null;
    if (!text && !file) { toast("Escribe algo o adjunta una foto."); return; }

    const btn = page.querySelector("#sendBtn");
    btn.disabled = true; btn.textContent = "Enviando…";

    const fd = new FormData();
    fd.append("text", text);
    if (file) fd.append("image", file);
    if (state._lastLat != null && state._lastLon != null) {
      fd.append("lat", String(state._lastLat));
      fd.append("lon", String(state._lastLon));
      // one-shot
      state._lastLat = null; state._lastLon = null;
    }

    const r = await apiFetch(`/chats/${chatId}/messages`, { method: "POST", body: fd });
    const j = await json(r);
    btn.disabled = false; btn.textContent = "Enviar";
    if (!r.ok || !j.ok) { toast(j.detail || "No se pudo enviar."); return; }

    page.querySelector("#chatText").value = "";
    page.querySelector("#chatFile").value = "";
    const l = page.querySelector("#fileLabel");
    if (l) { l.classList.remove("active"); l.textContent = "📷 Foto"; }

    // Refresh messages cache for this chat
    state.messages.delete(chatId);
    await drawMessages();
  }

  function drawChatList() {
    const wrap = page.querySelector("#chatListItems");
    wrap.innerHTML = "";
    state.chats.forEach(c => {
      const a = el("a", {
        href: "#/chat", class: "chatListItem " + (c.id === state.currentChatId ? "active" : ""), onclick: (e) => {
          e.preventDefault();
          state.currentChatId = c.id;
          drawChatList();
          drawMessages();
        }
      }, [
        el("div", {}, [
          el("div", { class: "t" }, c.title),
          el("div", { class: "s" }, "ID: " + c.id),
        ]),
        el("div", { class: "badge" }, "▶")
      ]);
      wrap.appendChild(a);
    });
  }

  const GREETINGS = [
    "Hola, soy Katara, ¿en qué te puedo ayudar?",
    "¡Hola! Soy Katara. Pregúntame sobre reciclaje o puntos de acopio.",
    "Hola, estoy aquí para ayudarte a cuidar el medio ambiente. ¿Qué necesitas saber?",
    "Saludos. Soy Katara, tu asistente de reciclaje. ¿Cómo puedo ayudarte hoy?"
  ];



  async function drawMessages() {
    const chatId = state.currentChatId;
    const msgs = await loadMessages(chatId);
    const box = page.querySelector("#chatMsgs");
    box.innerHTML = "";

    if (msgs.length === 0) {
      const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
      const row = el("div", { class: "bubbleRow assistant" });
      const bubble = el("div", { class: "bubble assistant" });
      bubble.appendChild(el("div", { class: "md", html: mdToHtml(greeting) }));
      bubble.appendChild(el("div", { style: "margin-top:8px;font-size:11px;color:var(--muted)" }, "Ahora"));
      row.appendChild(bubble);
      box.appendChild(row);
      return;
    }

    for (const m of msgs) {
      const isUser = m.role === "user";
      const row = el("div", { class: "bubbleRow " + (isUser ? "user" : "assistant") });
      const bubble = el("div", { class: "bubble " + (isUser ? "user" : "assistant") });
      const html = mdToHtml(m.content || "");
      bubble.appendChild(el("div", { class: "md", html }));
      if (m.image_url) {
        const imgBox = el("div", { class: "msgImg" });
        const img = el("img", { src: m.image_url, alt: "imagen", loading: "lazy" });
        img.addEventListener("click", () => showImageModal(m.image_url));
        imgBox.appendChild(img);
        bubble.appendChild(imgBox);
      }
      bubble.appendChild(el("div", { style: "margin-top:8px;font-size:11px;color:" + (isUser ? "rgba(255,255,255,.7)" : "var(--muted)") }, fmtTime(m.created_at)));
      row.appendChild(bubble);
      box.appendChild(row);
    }
    box.scrollTop = box.scrollHeight;
  }

  return page;
}

/* -------------------- RECOGNITION -------------------- */

function RecognitionPage() {
  // Main container: Card style but Full Height + Flex Column, and overflow hidden to manage scroll internally
  const page = el("div", { class: "card", style: "height:100%; display:flex; flex-direction:column; overflow:hidden;" }, [

    // 1. INPUT SECTION
    // We wrap it in 'pad-lg' and 'border-bottom' to distinct it, but keep the "Genial" styles.
    el("div", { class: "pad-lg", style: "flex-shrink:0; background:white; z-index:10; border-bottom:1px solid rgba(0,0,0,0.05);" }, [
      // Title
      el("div", { style: "font-weight:1000;color:var(--navy);font-size:18px;" }, "Reconocimiento por imagen"),
      el("div", { class: "smallHelp", style: "margin-top:6px;" }, "Sube o toma una foto. Katara responderá cómo reciclar o desechar en Guayaquil."),
      el("div", { class: "hr" }),

      // Original Input Row Layout
      el("div", { class: "row" }, [
        el("div", { style: "display:flex;gap:10px;align-items:center;" }, [
          el("input", {
            type: "file", id: "recFile", accept: "image/*", capture: "environment", class: "hidden", onchange: (e) => {
              const l = document.getElementById("recLabel");
              const f = e.target.files[0];
              if (f) { l.classList.add("active"); l.innerHTML = `<span style="color:var(--primary)">📷</span> Foto lista`; }
              else { l.classList.remove("active"); l.innerHTML = "📷 Foto"; }
            }
          }),
          el("label", { for: "recFile", id: "recLabel", class: "btn secondary small", style: "cursor:pointer;width:100%;text-align:center;justify-content:center;padding:12px;" }, "📷 Foto"),
        ]),
        el("textarea", { class: "textarea", id: "recQ", placeholder: "Pregunta (opcional)", rows: "3" },),
        el("button", { class: "btn", id: "recBtn", onclick: () => runRec() }, "Analizar"),
      ])
    ]),

    // 2. HISTORY SECTION
    // Flex 1 to fill remaining height. Removing the nested 'card pad-lg' wrapper to gain width.
    el("div", { class: "chatMsgs", id: "recMsgs", style: "flex:1; margin:0; border-radius:0; padding:16px 16px 40px 16px;" })
  ]);

  (async () => {
    await loadRecognitionChat();
    await renderRecHistory();
  })();

  async function loadRecognitionChat() {
    await loadChats();
    let rec = state.chats.find(c => (c.title || "").toLowerCase().includes("reconocimiento"));
    if (!rec) {
      const fd = new FormData(); fd.append("title", "Reconocimiento");
      const r = await apiFetch("/chats", { method: "POST", body: fd });
      const j = await json(r);
      if (r.ok && j.ok) {
        state.chats = []; // reload
        await loadChats();
        rec = state.chats.find(c => c.id === j.chat_id);
      }
    }
    state.recChatId = rec?.id || state.chats[0]?.id;
  }

  async function runRec() {
    const file = page.querySelector("#recFile").files[0] || null;
    const q = page.querySelector("#recQ").value.trim() || "";
    if (!file) { toast("Adjunta una foto."); return; }
    if (!q) { /* Optional question */ }

    const btn = page.querySelector("#recBtn");
    btn.disabled = true; btn.textContent = "Analizando…";
    const fd = new FormData();
    fd.append("text", q || "¿Qué es esto y cómo debo desecharlo o reciclarlo en Guayaquil?");
    fd.append("image", file);

    const r = await apiFetch(`/chats/${state.recChatId}/messages`, { method: "POST", body: fd });
    const j = await json(r);
    btn.disabled = false; btn.textContent = "Analizar";
    if (!r.ok || !j.ok) { toast(j.detail || "No se pudo analizar."); return; }

    page.querySelector("#recFile").value = "";
    const l = page.querySelector("#recLabel");
    if (l) { l.classList.remove("active"); l.innerHTML = "📷 Foto"; }

    page.querySelector("#recQ").value = "";
    state.messages.delete(state.recChatId);
    await renderRecHistory();
  }

  async function renderRecHistory() {
    const msgs = await loadMessages(state.recChatId);
    const box = page.querySelector("#recMsgs");
    box.innerHTML = "";
    for (const m of msgs) {
      const row = el("div", { class: "bubbleRow " + (m.role === "user" ? "user" : "assistant") });
      const bubble = el("div", { class: "bubble " + (m.role === "user" ? "user" : "assistant") });
      bubble.appendChild(el("div", { class: "md", html: mdToHtml(m.content || "") }));
      if (m.image_url) {
        const imgBox = el("div", { class: "msgImg" });
        const img = el("img", { src: m.image_url, alt: "imagen", loading: "lazy" });
        img.addEventListener("click", () => showImageModal(m.image_url));
        imgBox.appendChild(img);
        bubble.appendChild(imgBox);
      }
      row.appendChild(bubble);
      box.appendChild(row);
    }
    box.scrollTop = box.scrollHeight;
  }

  return page;
}

/* -------------------- POINTS -------------------- */

function PointsPage() {
  const page = el("div", { class: "card pad" }, [
    el("div", { style: "display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;" }, [
      el("div", {}, [
        el("div", { style: "font-weight:1000;color:var(--navy);font-size:18px;" }, "Puntos de recogida (Guayaquil)"),
        el("div", { class: "smallHelp", style: "margin-top:6px;" }, "Mapa + lista con búsqueda. Rutas abren en Google Maps.")
      ]),
      el("div", { class: "row", style: "min-width:260px;max-width:360px;width:100%;" }, [
        el("input", { class: "input", id: "pointSearch", placeholder: "Buscar por nombre o dirección…" }),
      ])
    ]),
    el("div", { class: "hr" }),
    el("div", { class: "mapWrap", id: "map" }),
    el("div", { class: "list", id: "pointList" })
  ]);

  (async () => {
    await loadPoints();
    await initMap();
    drawPoints();
  })();

  async function loadPoints() {
    if (state.pointsLoaded) return state.points;
    const r = await apiFetch("/points");
    const j = await json(r);
    if (!r.ok) { toast("No se pudieron cargar puntos."); return []; }
    state.points = (j || []).map(p => ({
      ...p,
      route_url: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.address)}`,
    }));
    state.pointsLoaded = true;

    // hydrate cache from localStorage
    try {
      const cached = JSON.parse(localStorage.getItem("katara_geocode_cache") || "{}");
      for (const [k, v] of Object.entries(cached)) state.geocodeCache.set(k, v);
    } catch (_) { }

    // client-side geocode missing coords (optional)
    await geocodeMissingPoints();
    return state.points;
  }

  function cacheKey(addr) {
    return "addr_" + (addr || "").toLowerCase().trim().replace(/\s+/g, " ").slice(0, 160);
  }

  async function geocodeMissingPoints() {
    const { ARCGIS_API_KEY } = getConfig();
    if (!ARCGIS_API_KEY) return;

    let changed = false;
    let count = 0;
    for (const p of state.points) {
      if (p.lat != null && p.lon != null) continue;
      const key = cacheKey(p.address);
      if (state.geocodeCache.has(key)) {
        const v = state.geocodeCache.get(key);
        p.lat = v.lat; p.lon = v.lon;
        continue;
      }
      // limit per session to avoid hammering
      if (count >= 12) break;

      const loc = await geocodeArcGIS(p.address + ", Guayaquil, Ecuador", ARCGIS_API_KEY);
      if (loc) {
        p.lat = loc.lat; p.lon = loc.lon;
        state.geocodeCache.set(key, loc);
        changed = true;
        count += 1;
        await sleep(220);
      }
    }
    if (changed) {
      const obj = {};
      for (const [k, v] of state.geocodeCache.entries()) obj[k] = v;
      localStorage.setItem("katara_geocode_cache", JSON.stringify(obj));
    }
  }

  async function geocodeArcGIS(address, token) {
    try {
      const u = new URL("https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates");
      u.searchParams.set("f", "json");
      u.searchParams.set("singleLine", address);
      u.searchParams.set("maxLocations", "1");
      u.searchParams.set("outFields", "Match_addr,Addr_type");
      u.searchParams.set("token", token);
      const r = await fetch(u.toString());
      const j = await r.json();
      const c = (j.candidates || [])[0];
      if (!c?.location) return null;
      return { lat: c.location.y, lon: c.location.x };
    } catch (_) { return null; }
  }

  async function initMap() {
    if (state.map) return;
    const mapEl = page.querySelector("#map");
    state.map = L.map(mapEl, { zoomControl: true }).setView([-2.1894, -79.8891], 12);
    // ArcGIS tiles (free)
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "&copy; Esri"
    }).addTo(state.map);
  }

  function clearMarkers() {
    state.markers.forEach(m => m.remove());
    state.markers = [];
  }

  function drawPoints() {
    const search = page.querySelector("#pointSearch");
    const listEl = page.querySelector("#pointList");

    function apply() {
      const q = (search.value || "").toLowerCase().trim();
      const filtered = state.points.filter(p => {
        const s = (p.name + " " + p.address + " " + (p.category || "") + " " + (p.notes || "")).toLowerCase();
        return !q || s.includes(q);
      });

      listEl.innerHTML = "";
      clearMarkers();

      // Markers
      for (const p of filtered) {
        if (p.lat != null && p.lon != null) {
          const m = L.marker([p.lat, p.lon]).addTo(state.map);
          m.bindPopup(`<b>${escapeHtml(p.name)}</b><br/>${escapeHtml(p.address)}<br/><a href="${p.route_url}" target="_blank" rel="noopener noreferrer">Abrir ruta</a>`);
          state.markers.push(m);
        }
      }
      if (state.markers.length) {
        const g = new L.featureGroup(state.markers);
        state.map.fitBounds(g.getBounds().pad(0.2));
      }

      // List
      filtered.forEach(p => {
        const card = el("div", { class: "pointCard" }, [
          el("div", {}, [
            el("div", { class: "name" }, p.name),
            el("div", { class: "addr" }, p.address),
            el("div", { class: "meta" }, [
              el("span", { class: "badge" }, p.category || "punto"),
              p.lat != null && p.lon != null ? el("span", { class: "badge" }, "📍 en mapa") : el("span", { class: "badge" }, "sin coordenadas"),
            ])
          ]),
          el("div", { class: "actions pointActions" }, [
            el("button", {
              class: "btn secondary small", onclick: () => {
                window.open(p.route_url, "_blank", "noopener,noreferrer");
              }
            }, "Ruta"),
            el("button", {
              class: "btn small", onclick: () => {
                if (p.lat != null && p.lon != null) {
                  state.map.setView([p.lat, p.lon], 16);
                  const marker = state.markers.find(m => {
                    const ll = m.getLatLng();
                    return Math.abs(ll.lat - p.lat) < 1e-6 && Math.abs(ll.lng - p.lon) < 1e-6;
                  });
                  marker?.openPopup();
                } else {
                  toast("Este punto no tiene coordenadas aún.");
                }
              }
            }, "Ver")
          ])
        ]);
        listEl.appendChild(card);
      });

      if (!filtered.length) {
        listEl.appendChild(el("div", { class: "card pad" }, "No hay resultados con esa búsqueda."));
      }
    }

    search.addEventListener("input", apply);
    apply();
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  return page;
}

/* -------------------- PROFILE -------------------- */

function ProfilePage() {
  const page = el("div", { class: "card pad" }, [
    el("div", { class: "row2" }, [
      el("div", { class: "card pad-lg" }, [
        el("div", { style: "font-weight:1000;color:var(--navy);font-size:18px;" }, "Tu perfil"),
        el("div", { class: "smallHelp", style: "margin-top:6px;" }, "Edita tu bio, username y foto. El email es tu identificador principal."),
        el("div", { class: "hr" }),
        el("div", { style: "display:flex;align-items:center;gap:12px;flex-wrap:wrap;" }, [
          el("img", { id: "avatarImg", src: state.me?.avatar_url || "./assets/profile.svg", alt: "avatar", style: "width:72px;height:72px;border-radius:18px;border:1px solid rgba(15,23,42,.10);background:#fff;object-fit:cover;" }),
          el("div", {}, [
            el("div", { style: "font-weight:1000;color:var(--navy);font-size:16px;" }, state.me?.username || ""),
            el("div", { class: "smallHelp" }, state.me?.email || ""),
            el("div", { class: "badge", style: "margin-top:6px;" }, state.me?.is_verified ? "Correo verificado" : "Sin verificar")
          ])
        ]),
        el("div", { class: "hr" }),
        el("div", { class: "row" }, [
          el("div", {}, [el("div", { class: "label" }, "Username"), el("input", { class: "input", id: "uName", value: state.me?.username || "" })]),
          el("div", {}, [el("div", { class: "label" }, "Biografía"), el("textarea", { class: "textarea", id: "uBio" }, state.me?.bio || "")]),
          el("div", {}, [
            el("div", { class: "label" }, "Foto de perfil"),
            el("div", { style: "display:flex;gap:10px;align-items:center;" }, [
              el("input", {
                class: "hidden", type: "file", id: "uAvatar", accept: "image/*", onchange: (e) => {
                  const l = document.getElementById("uAvatarLabel");
                  const f = e.target.files[0];
                  if (f) {
                    l.classList.add("active");
                    l.innerHTML = `<span style="color:var(--primary)">📷</span> ${f.name}`;
                    l.style.borderColor = "var(--primary)";
                    l.style.background = "var(--primary-light)";
                  } else {
                    l.classList.remove("active");
                    l.innerHTML = "📷 Cambiar foto";
                    l.style.borderColor = "";
                    l.style.background = "";
                  }
                }
              }),
              el("label", {
                for: "uAvatar",
                id: "uAvatarLabel",
                class: "btn secondary small",
                style: "cursor:pointer;width:100%;text-align:center;justify-content:center;padding:12px;border:1px dashed var(--navy);color:var(--navy);background:transparent;"
              }, "📷 Cambiar foto")
            ])
          ]),
          el("button", { class: "btn", id: "saveProfile", onclick: () => saveProfile() }, "Guardar cambios")
        ])
      ])
    ]),
    el("div", { class: "card pad-lg" }, [
      el("div", { style: "font-weight:1000;color:var(--navy);font-size:18px;" }, "Seguridad"),
      el("div", { class: "smallHelp", style: "margin-top:6px;" }, "Cambia tu contraseña."),
      el("div", { class: "hr" }),
      el("div", { class: "row" }, [
        el("div", {}, [el("div", { class: "label" }, "Contraseña actual"), el("input", { class: "input", type: "password", id: "cpNow" })]),
        el("div", {}, [el("div", { class: "label" }, "Nueva contraseña"), el("input", { class: "input", type: "password", id: "cpNew" })]),
        el("button", { class: "btn secondary", id: "cpBtn", onclick: () => changePassword() }, "Cambiar contraseña"),
        el("button", { class: "btn ghost", onclick: () => { logout(); } }, "Cerrar sesión")
      ]),
      el("div", { class: "hr" }),
      el("div", { class: "smallHelp" }, [
        "Cambiar email requiere verificación. En esta versión, el email se mantiene fijo para proteger tu cuenta."
      ])
    ])
  ]);

  async function saveProfile() {
    const btn = page.querySelector("#saveProfile");
    btn.disabled = true; btn.textContent = "Guardando…";
    const fd = new FormData();
    fd.append("username", page.querySelector("#uName").value.trim());
    fd.append("bio", page.querySelector("#uBio").value);
    const av = page.querySelector("#uAvatar").files[0];
    if (av) fd.append("avatar", av);

    const r = await apiFetch("/me", { method: "PATCH", body: fd });
    const j = await json(r);
    btn.disabled = false; btn.textContent = "Guardar cambios";
    if (!r.ok || !j.ok) { toast(j.detail || "No se pudo guardar."); return; }
    toast("Perfil actualizado.");
    state.me = null;
    await ensureMe();
    render();
  }

  async function changePassword() {
    const btn = page.querySelector("#cpBtn");
    btn.disabled = true; btn.textContent = "Cambiando…";
    const body = { current_password: page.querySelector("#cpNow").value, new_password: page.querySelector("#cpNew").value };
    const r = await apiFetch("/me/change-password", { method: "POST", body });
    const j = await json(r);
    btn.disabled = false; btn.textContent = "Cambiar contraseña";
    if (!r.ok || !j.ok) { toast(j.detail || "No se pudo cambiar."); return; }
    toast("Contraseña actualizada.");
    page.querySelector("#cpNow").value = "";
    page.querySelector("#cpNew").value = "";
  }

  return page;
}

/* -------------------- SETTINGS -------------------- */

function SettingsPage() {
  const cfg = getConfig();
  const page = el("div", { class: "card pad" }, [
    el("div", { class: "row2" }, [
      el("div", { class: "card pad-lg" }, [
        /* Settings configuration removed for final user */
        el("div", { style: "font-weight:1000;color:var(--navy);font-size:18px;" }, "Ajustes"),
        el("div", { class: "smallHelp", style: "margin-top:6px;" }, "Opciones de la aplicación."),
        el("div", { class: "hr" }),
        el("button", {
          class: "btn secondary", onclick: () => {
            localStorage.removeItem("katara_geocode_cache");
            toast("Cache de mapa limpiado.");
          }
        }, "Recargar datos de mapa"),
      ]),
      el("div", { class: "card pad-lg" }, [
        el("div", { style: "font-weight:1000;color:var(--navy);font-size:18px;" }, "Contacto"),
        el("div", { class: "smallHelp", style: "margin-top:6px;" }, "Envía un mensaje al equipo de KataraLM."),
        el("div", { class: "hr" }),
        el("div", { class: "row" }, [
          el("input", { class: "input", id: "cEmail", placeholder: "Tu email (opcional)", value: state.me?.email || "" }),
          el("textarea", { class: "textarea", id: "cMsg", placeholder: "Mensaje", rows: "5" }),
          el("button", { class: "btn", id: "cBtn", onclick: () => sendContact() }, "Enviar"),
          el("a", { href: "https://wa.me/593983941273?text=Hola,%20estoy%20usando%20KataraLM", target: "_blank", rel: "noopener noreferrer", style: "color:var(--link);font-weight:900;text-decoration:none;" },
            "Contactar por WhatsApp")
        ])
      ])
    ])
  ]);

  async function sendContact() {
    const btn = page.querySelector("#cBtn");
    btn.disabled = true; btn.textContent = "Enviando…";
    const body = { email: page.querySelector("#cEmail").value.trim() || null, message: page.querySelector("#cMsg").value.trim() };
    const r = await apiFetch("/contact", { method: "POST", auth: false, body }); // contact endpoint doesn't require auth
    const j = await json(r);
    btn.disabled = false; btn.textContent = "Enviar";
    if (!r.ok || !j.ok) { toast(j.detail || "No se pudo enviar."); return; }
    toast("¡Enviado!");
    page.querySelector("#cMsg").value = "";
  }

  return page;
}

/* -------------------- ABOUT -------------------- */

function AboutPage() {
  const page = el("div", { class: "card pad" }, [
    el("div", { class: "card pad-lg" }, [
      el("div", { class: "banner" }, [el("img", { src: "./assets/KataraLM_banner.png", alt: "banner" })]),
      el("div", { style: "height:12px" }),
      el("div", { class: "brandRow" }, [
        el("img", { src: "./assets/KataraLM_logo.png", alt: "logo" }),
        el("div", {}, [
          el("div", { class: "brandTitle" }, "KataraLM"),
          el("div", { class: "brandSub" }, "Créditos y responsabilidad")
        ])
      ]),
      el("div", { class: "hr" }),
      el("div", { class: "row2" }, [
        el("div", {}, [
          el("h3", { style: "margin:0 0 8px;color:var(--navy);" }, "Créditos"),
          el("div", { class: "smallHelp" }, [
            "Desarrollado y mantenido por ", el("b", {}, "Grupo 2"), ",", el("b", {}, " el mago"), " y registrado bajo ", el("b", {}, "Wicca Inc."), el("br"),
            "KataraLM es una herramienta educativa para apoyar hábitos de reciclaje y sostenibilidad.", el("br"),
            "Usando esta aplicación aceptas nuestros ", el("a", { href: "https://katara.pages.dev/terms", target: "_blank", rel: "noopener noreferrer", style: "color:var(--link);font-weight:900;text-decoration:none;" }, "Términos y Condiciones")
          ])
        ]),
        el("div", {}, [
          el("h3", { style: "margin:0 0 8px;color:var(--navy);" }, "Descargo"),
          el("div", { class: "smallHelp" }, [
            "La información puede variar según normativa y gestión local. ",
            "Usa siempre indicaciones oficiales y sentido común para residuos peligrosos."
          ])
        ])
      ]),
      el("div", { class: "hr" }),
      el("div", { class: "row2" }, [
        el("a", { href: "#/settings", class: "btn secondary", style: "text-decoration:none;display:inline-flex;justify-content:center;align-items:center;" }, "Contacto"),
        el("a", { href: "#/points", class: "btn", style: "text-decoration:none;display:inline-flex;justify-content:center;align-items:center;" }, "Ver puntos")
      ])
    ])
  ]);
  return page;
}
