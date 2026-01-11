# 🧠 KataraLM Backend

API RESTful desarrollada en **FastAPI** que gestiona la lógica de negocio, autenticación, base de datos e integración con modelos de IA (Groq).

## ✨ Características

- **Autenticación Segura**: 
  - Registro con verificación de email (OTP).
  - Login con contraseña hasheada (Bcrypt + Pepper).
  - Recuperación de contraseña vía email.
- **Gestión de Usuarios**: Perfiles personalizables (Bio, Avatar).
- **Chat Inteligente**: 
  - Historial persistente.
  - Soporte multimodal (texto e imágenes).
  - Integración con **Llama 3** y **Llama 4** (Vision).
- **Geolocalización**: Endpoints para buscar puntos de acopio cercanos y geocodificación inversa.

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- Python 3.10 o superior.
- Pip.

### Pasos

1. **Crear Entorno Virtual**
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # Mac/Linux:
   source .venv/bin/activate
   ```

2. **Instalar Dependencias**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configuración de Entorno**
   - Copia el archivo de ejemplo:
     ```bash
     cp .env.example .env
     ```
   - **IMPORTANTE**: Edita el archivo `.env` y rellena las claves necesarias:
     - `GROQ_API_KEY_CHAT` / `VISION`: Para la inteligencia del chatbot.
     - `RESEND_API_KEY`: Para el envío de correos (OTP).
     - `ARCGIS_API_KEY`: Para mapas y geolocalización.
     - `JWT_SECRET`: Cambia esto por una cadena segura y aleatoria.

4. **Ejecutar el Servidor**
   ```bash
   python -m app
   ```
   El servidor iniciará por defecto en `http://0.0.0.0:6767`.

5. **Sembrar Datos (Opcional)**
   Si deseas cargar puntos de acopio iniciales:
   ```bash
   python -m app.seed
   ```

## 📂 Estructura

- `app/`: Código fuente.
  - `routers/`: Endpoints de la API.
  - `services/`: Lógica externa (Groq, Mailer, ArcGIS).
  - `utils/`: Utilidades de seguridad y archivos.
- `data/`: Base de datos SQLite y archivos subidos (se crea al iniciar).
- `static/`: Recursos estáticos (imágenes de marca, emails).
