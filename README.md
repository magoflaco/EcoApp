# 🍃 KataraLM

**KataraLM** es un [ecosistema completo](https://katara.pages.dev/) para la gestión ambiental y asistencia inteligente en Guayaquil, integrado por una aplicación móvil, una webapp moderna y un backend robusto potenciado por IA.

![Katara Banner](webapp/KataraLM_banner.png)

## 🚀 Componentes del Proyecto

El proyecto está dividido en tres módulos principales:

### 1. 📱 Android App (`/android`)
Una aplicación nativa desarrollada en **Kotlin** que encapsula la experiencia web, proporcionando acceso a características nativas como:
- Geolocalización precisa.
- Manejo de cámara y galería para reconocimiento de imágenes.
- Descargas y gestión de archivos.

### 2. 🌐 Webapp (`/webapp`)
Una Single Page Application (SPA) ultraligera y estática, diseñada para ser desplegada en **Cloudflare Pages** o cualquier servidor estático.
- **Tecnologías**: HTML5, CSS3, Vanilla JS.
- **Características**: Diseño responsive, mapas interactivos (ArcGIS/Leaflet), chat en tiempo real con IA.

### 3. 🧠 Backend (`/backend`)
El cerebro de KataraLM, una API RESTful construida con **FastAPI (Python)**.
- **Autenticación**: JWT seguro (Access + Refresh tokens).
- **IA**: Integración con modelos Llama 3/4 vía Groq para chat y visión.
- **Geocoding**: Servicios de ubicación y rutas.
- **Base de Datos**: SQLite (fácil de migrar) para usuarios, chats y puntos de acopio.

---

## 🛠️ Configuración Rápida

Para poner en marcha el proyecto localmente:

### Backend
1. Navega a `backend/`.
2. Copia `.env.example` a `.env` y configura tus API Keys (Groq, Resend, etc.).
3. Instala dependencias: `pip install -r requirements.txt`.
4. Ejecuta: `python -m app`.

### Webapp
1. Navega a `webapp/`.
2. Simplemente sirve la carpeta con cualquier servidor (ej. `python -m http.server`).
3. Configura la URL de tu backend en la página de Ajustes (`#/settings`).

### Android
1. Abre la carpeta `android/` en **Android Studio**.
2. Sincroniza Gradle y ejecuta en tu emulador o dispositivo.

---

## 📄 Licencia y Créditos

Este proyecto utiliza tecnologías open source. Revisa los términos de uso en la webapp.

No dudes en usar la [app](https://apkpure.com/p/online.wiccagirl.kataralm) o visitar la [web](https://katara.pages.dev/)

Hecho con ❤️ para un futuro más verde en Ecuador. 

**el mago**

**Wicca Inc.**



