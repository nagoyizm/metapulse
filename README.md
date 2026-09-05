# ⚡ MetaPulse — Suite de Gestión, Programación y Analítica de Redes Sociales (Facebook & Instagram)

> Plataforma completa local para programar publicaciones, historias, reels y carruseles en **Páginas de Facebook** y **Cuentas de Instagram Business** usando Meta Graph API (v21.0), con generador de copys con IA, estampador de marca de agua/logo y estadísticas en tiempo real.

---

## 🌟 Características Principales

1. **Gestión Inteligente de Publicaciones & Formatos**:
   - Soporte para **Facebook Pages** e **Instagram Business**.
   - Publicación en **Feed estándar**, **Historias (Stories)**, **Reels/Video** y **Carruseles de múltiples imágenes**.
   - Contador de caracteres por red y biblioteca de hashtags dinámicos.
   - **Previsualizador en tiempo real (Live Mockups)** idéntico a las aplicaciones oficiales de Facebook e Instagram.

2. **Motor de Programación Automática (Slot-Based & Exact-Time Scheduler)**:
   - Configura horarios fijos por día de la semana (ej: Lunes 10:00, 15:00, 20:00).
   - Modo *"Próximo slot disponible"*: asigna automáticamente la publicación al siguiente horario libre sin pisar posts existentes.
   - Modo *"Fecha y hora exacta"*: programa publicaciones con un selector interactivo.
   - Demonio en segundo plano (`node-cron`) que chequea la cola cada minuto, gestiona reintentos con backoff exponencial (hasta 3 intentos) y previene envíos duplicados.

3. **Herramienta de Branding & Marca de Agua**:
   - Sube tu logotipo o firma en PNG transparente.
   - Selección visual de posición (Superior Der/Izq, Inferior Der/Izq, Centro), opacidad graduable y tamaño relativo.
   - Adaptación de aspecto en un clic: Cuadrado 1:1, Vertical 4:5 y Story/Reel 9:16.

4. **Asistente de Redacción con Inteligencia Artificial**:
   - Generación instantánea de copys con gancho (Hook), cuerpo narrativo, llamada a la acción (CTA) y hashtags segmentados.
   - Soporte para Google Gemini (1.5 Flash), OpenAI (GPT-4o), Anthropic Claude o plantillas copywriting de alta conversión 100% locales (sin API key obligatoria).

5. **Panel de Analíticas & Insights**:
   - Métricas de Alcance (Reach), Impresiones, Tasa de Interacción (Engagement) y Seguidores.
   - Gráficos interactivos en Canvas para monitorear el crecimiento semanal.

6. **Asistente de Configuración & Token Wizard**:
   - Paso a paso para convertir tokens temporales en **Tokens de 60 días** e importar el **Page Token permanente** y el ID de Instagram en 1 clic.
   - Modo Simulación / Sandbox incluido para probar todo el flujo localmente antes de conectar las cuentas reales.

---

## 🚀 Inicio Rápido

### 1. Requisitos Previos
- **Node.js** v18 o superior instalado.
- Una Página de Facebook donde seas **Administrador**.
- Una cuenta de **Instagram Profesional** (Business o Creator) vinculada a tu Página de Facebook.

### 2. Instalación y Ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar el servidor
npm start
```

Abre tu navegador en: **`http://localhost:3000`**

---

## 🔑 Guía Paso a Paso: Obtener Tokens en Meta for Developers

### Paso 1: Crear tu App en Meta
1. Ve a [developers.facebook.com/apps](https://developers.facebook.com/apps/) y haz clic en **Crear app**.
2. Selecciona el tipo **Otro / None** o **Negocios (Business)**.
3. Asigna un nombre (ej: `Mi Suite de Redes Sociales`) y completa la creación.
4. En **Configuración > Información básica**, anota:
   - `APP ID` (ej: `123456789012345`)
   - `APP SECRET` (Haz clic en *Mostrar* y copia el secreto)

### Paso 2: Generar tu User Access Token con Permisos
1. Ve a [developers.facebook.com/tools/explorer/](https://developers.facebook.com/tools/explorer/).
2. Arriba a la derecha, en **Aplicación**, selecciona la App que acabas de crear.
3. En **Permisos (Scopes)**, asegúrate de marcar:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `instagram_basic`
   - `instagram_content_publish`
   - `instagram_manage_comments`
   - `public_profile`
4. Haz clic en **Generate Access Token**, acepta el consentimiento en Facebook y copia el token resultante (`EAA...`).

### Paso 3: Enlazar tu Cuenta en MetaPulse
1. Entra a la pestaña **Conexión Meta & Ajustes** en la Web App (`http://localhost:3000`).
2. Pega tu `APP ID`, `APP SECRET` y el `User Access Token`.
3. Presiona **"⚡ Convertir a Token de Larga Duración (60 días)"**.
4. Presiona **"🔍 Detectar Páginas de Facebook e Instagram"**.
5. Haz clic en **"Vincular Cuenta"** en la página detectada. ¡Listo! El sistema guardará el token permanente de forma local y segura.

---

## 📁 Estructura del Proyecto

```
proyecto-manejo-redes-sociales/
├── package.json
├── server.js                      # Servidor Express & Scheduler Daemon
├── data/
│   └── metapulse.sqlite           # Base de datos SQLite local
├── uploads/                       # Imágenes, videos y marcas de agua procesadas
│   ├── watermarks/
│   └── processed/
├── src/
│   ├── database/
│   │   └── db.js                  # Esquemas y operaciones de base de datos
│   ├── services/
│   │   ├── metaService.js         # Meta Graph API v21.0 (Publicación, Tokens, Insights)
│   │   ├── schedulerService.js    # Motor de colas, slots y cron worker
│   │   ├── imageService.js        # Procesamiento Sharp (Logo overlay, presets de formato)
│   │   └── aiService.js           # Asistente de redacción IA (Gemini / OpenAI / Claude)
│   └── routes/
│       └── api.js                 # API REST completa
└── public/                        # Aplicación Web Frontend (SPA)
    ├── index.html                 # Vista principal
    ├── css/
    │   ├── style.css              # Sistema de diseño y tema oscuro
    │   └── previews.css           # Maquetas oficiales Facebook & Instagram
    └── js/
        ├── app.js                 # Orquestador del frontend
        ├── composer.js            # Redactor interactivo y live preview
        ├── calendar.js            # Gestión de colas y horarios semanales
        ├── analytics.js           # Gráficos Canvas e Insights
        ├── watermark.js           # Editor de marca de agua y formatos
        └── settings.js            # Asistente de configuración de tokens
```

---

## ⚙️ Ingesta de Medios en Instagram (Aviso Técnico)
La API de Instagram requiere que las imágenes y videos se encuentren en una URL pública accesible por sus servidores para poder descargarlas durante la publicación.
- Si ejecutas en local (`localhost`), puedes usar una herramienta como [localtunnel](https://localtunnel.github.io/www/) o [ngrok](https://ngrok.com/) y colocar tu URL en la sección *Ajustes > URL Pública* (ej: `https://mi-tunel.loca.lt`).
- O puedes activar el **Modo Simulación / Sandbox** en la pestaña de Ajustes para probar todo el flujo de programación y colas en local sin restricciones.
