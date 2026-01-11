# 📱 KataraLM Android

Aplicación nativa para Android escrita en **Kotlin** que encapsula la experiencia web de KataraLM, añadiendo capacidades del sistema.

## 🚀 Integración

Esta app utiliza un `WebView` avanzado para mostrar el contenido de `webapp/` (que debe copiarse en `app/src/main/assets/webapp` si se modifica).
- **Comunicación Puente**: Permite ejecutar funciones nativas desde JS (futuro).
- **Manejo de Archivos**: Descargas directas al sistema de archivos de Android.
- **Geolocalización Nativa**: Permisos de ubicación en tiempo real para el mapa.

## 🛠️ Requisitos

- **Android Studio** Iguana (2023.2.1) o superior.
- **JDK 17**.
- Dispositivo o Emulador con **Android 8.1 (API 27)** o superior.

## 📲 Compilación

1. Abre la carpeta `android/` en Android Studio.
2. Espera a que Gradle sincronice las dependencias.
3. Conecta tu dispositivo o inicia un emulador.
4. Presiona el botón ▶️ **Run 'app'**.

## ⚙️ Configuración

### Backend URL
La aplicación móvil carga la interfaz web. Para configurar la URL del backend:
1. Abre la app en el móvil.
2. Navega a la sección de **Ajustes** dentro de la app (es la misma interfaz web).
3. Cambia la URL del backend y guarda. La configuración persiste en el almacenamiento local del WebView.

### Permitir Tráfico HTTP (Desarrollo)
Por defecto, la configuración `android:usesCleartextTraffic="true"` en el Manifiesto permite conectar a servidores locales (HTTP) para pruebas. Para producción, asegúrate de que tu backend tenga HTTPS y considera desactivar esta opción para mayor seguridad.
