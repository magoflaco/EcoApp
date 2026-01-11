# 🌐 KataraLM Frontend

Aplicación web progresiva (PWA) construida con tecnologías web estándar (HTML/CSS/JS) sin dependencias de compilación complejas.

## ⚡ Características

- **Zero-Build**: Código nativo, listo para desplegar.
- **SPA (Single Page Application)**: Navegación fluida usando Hash Routing (`#/chat`, `#/profile`).
- **Diseño Moderno**: CSS personalizado con soporte para modo oscuro y animaciones.
- **Mapas Interactivos**: Integración con Leaflet y tiles de ArcGIS.

## ⚙️ Configuración

### Conexión con Backend
La webapp necesita saber dónde está alojado tu backend.
1. Abre la aplicación en tu navegador.
2. Ve a **Ajustes** (icono de engranaje o `#/settings`).
3. En el campo "URL del Backend", ingresa la dirección de tu servidor API (ej. `http://localhost:6767` o tu dominio público).

### ArcGIS (Mapas)
Para que los mapas funcionen correctamente sin límites o marcas de agua, y para usar geocodificación (buscar direcciones):
1. Edita `js/config.js` y coloca tu **API Key de ArcGIS** en la constante `DEFAULTS`.
2. O bien, ingrésala directamente desde la interfaz de Ajustes en el navegador.

## 📦 Despliegue

Esta carpeta está lista para ser subida a cualquier hosting de contenido estático:
- **Cloudflare Pages**: Simplemente sube esta carpeta (drag & drop).
- **GitHub Pages**: Sube el contenido a una rama `gh-pages` (o configura la fuente a esta carpeta).
- **Netlify**: Arrastra la carpeta al panel de control.
- **Vercel**: Importa el repo y configura el directorio raíz a `webapp`.

No se requiere `npm build` ni scripts de compilación.
