# TASK — Estado y Auditoría para Claude

**Estado:** TERMINADO Y DESPLEGADO EN CONTABO (`main`, commit `b44b142` + docs).

## Resumen del trabajo realizado
Se reformuló por completo el Estudio de Reels a pedido del dueño:
1. **Desacoplamiento total entre Video y Textos:**
   - **Paso 3 (Cortes y Encuadre):** Pista exclusiva de video. Orden de tomas, tiempos de corte, encuadre 9:16 interactivo (pan X/Y por slider o arrastre con mouse sobre la mini pantalla, zoom, modo crop/blur) y transiciones dinámicas xfade (*Zoom Dinámico/Punch*, *Slide rápido*, *Flash blanco*, *Paneo suave*, *Disolución*, *Corte directo*).
   - **Paso 4 (Textos y Efectos):** Capa flotante de textos con línea de tiempo global independiente (`start` a `end` en segundos). Un texto puede abarcar múltiples tomas de video y mantenerse continuo durante transiciones.
2. **14 Tipografías Virales instaladas:**
   - `Archivo Black`, `Bangers`, `Titan One`, `Righteous`, `Syne`, `Bebas Neue`, `Anton`, `Montserrat Bold`, `Poppins Bold`, `Oswald Bold`, `Playfair Display`, `Cinzel Bold`, `Caveat`, `Lato Bold`.
   - Binarios `.ttf` descargados a `assets/fonts/` (necesarios para FFmpeg en Contabo porque no tiene fuentes del sistema).
3. **Efectos de Animación y Estilos:**
   - Animaciones: `pop` (punch viral con escala y desplazamiento elástico), `fade` suave, `slide` up desde abajo, `bounce` elástico, `none` (corte directo). Renderizadas con expresiones matemáticas de tiempo en `alpha` e `y` en FFmpeg y con keyframes CSS en la mini pantalla.
   - Estilos: Cápsula amarilla viral TikTok, Cápsula oscura elegante, Borde de impacto Hormozi, Resplandor neón, Sombra limpia.
   - Botón "Previsualizar" por texto en mini pantalla 9:16.
   - Botón "Sugerir textos con IA" (`POST /api/reel/suggest-texts`) que consulta a Gemini para generar ganchos sin alterar los cortes de video ya hechos.
   - Botón "Aplicar esta fuente y estilo a todos".
4. **Resistencia a F5:**
   - Serialización continua en `localStorage` (`metapulse_reel_studio_draft`) para evitar pérdidas de clips subidos, encuadres, cortes y textos ante recargas accidentales.

## Archivos modificados y creados
- `public/index.html` (stepper 5 pasos, panel paso 4 de textos, Google Fonts link, cache busters v3.4 / v2.6).
- `public/css/style.css` (clases de fuentes, keyframes de animación, estilo amarillo viral, badges de timing).
- `public/js/reelStudio.js` (controlador del stepper de 5 pasos, desacoplamiento de tomas y textos, mini pantalla 9:16 interactiva, persistencia `localStorage`).
- `src/services/reelStudioService.js` (motor FFmpeg desacoplado: xfade concatenado + drawtext en master stream con expresiones de tiempo, 14 fuentes mapeadas, `suggestTextOverlays`).
- `src/routes/api.js` (endpoint `POST /api/reel/suggest-texts`, soporte de `textOverlays` en `POST /api/reel/render`).
- `assets/fonts/*.ttf` (5 nuevos binarios: ArchivoBlack, Bangers, TitanOne, Righteous, Syne).
- `CURRENT_STATE.md`, `docs/decisions.md`, `docs/architecture.md`, `TASK.md` (actualizados con toda la arquitectura y decisiones).

## Despliegue en Contabo
- Respaldada base de datos SQLite en `/root/data_backup_*`.
- Git merge `--ff-only` a `origin/main`.
- `pm2 restart social-manager` (online).
- Verificado que las 14 fuentes existen en `/var/www/social-manager/assets/fonts/` (0 faltantes).
- Verificado `HTTP 200` en `http://localhost:3000`.
