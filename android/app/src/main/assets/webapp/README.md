# KataraLM Frontend (Cloudflare Pages)

✅ 100% estático (sin build). Solo sube esta carpeta a Cloudflare Pages.
✅ SPA con rutas por hash (`#/chat`, `#/points`, etc.) para evitar config de rewrite.

## Configuración
1) Abre `#/settings`
2) Pon la URL del backend (ejemplo: `https://algo.trycloudflare.com`)
3) Opcional: pega tu **ArcGIS API Key** para geocodificar puntos sin coordenadas

También puedes abrir con:
`/?api=https://algo.trycloudflare.com`

## Funcionalidades integradas (backend v2)
- Registro + verificación por OTP
- Login por contraseña
- Recuperación de contraseña por OTP
- Perfil: username, bio, avatar, cambio de contraseña
- Chats + imágenes (burbujas + Markdown)
- Reconocimiento (chat separado)
- Puntos: mapa (Leaflet + tiles ArcGIS) + lista con búsqueda + rutas

## Subir a Pages
- Selecciona "Direct Upload" o conecta repo.
- Publica el directorio raíz del proyecto.
