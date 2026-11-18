# TASK — Reels: vista previa de la secuencia + frases de voz con tiempo

Respaldo: etiqueta git `reels-v2`. Ejecutor: NO hacer commit. Respetar los saltos de línea de cada archivo.

## Archivos permitidos
- `public/js/reelStudio.js`
- `public/index.html` (solo la sección de voz del paso 5, los controles de la mini pantalla y los cache busters)
- `public/css/style.css`
- `src/services/reelStudioService.js`
- `src/routes/api.js` (solo `POST /reel/render`)

No leer completos los archivos grandes: usar grep y rangos.

---

## Parte A — Vista previa de la secuencia completa en la mini pantalla (antes del render)

Objetivo: el dueño ve, sin renderizar, cómo quedan las tomas en orden con sus transiciones, los textos con sus animaciones y las frases de voz en sus tiempos.

### A1. Línea de tiempo compartida (front)
Crear `buildTimeline()` en `reelStudio.js`, que reproduzca EXACTAMENTE la cuenta del servidor (`reelStudioService.render`, cerca de las líneas 590-625):
- Largo de cada toma: `len = clamp(Number(length) || 2.5, 0.8, 8)`.
- Si ninguna toma (desde la segunda) tiene transición xfade válida → concatenación plana: cada toma empieza donde termina la anterior y el total es la suma de los largos.
- Si hay xfade: `currentDur = len0`; para cada toma siguiente, `transDur = min(0.35, currentDur*0.35, nextLen*0.35)` y `offset = currentDur - transDur`. La toma siguiente empieza en `offset` y luego `currentDur = offset + nextLen`.
- Devuelve `{ total, items: [{ idx, startAt, len, transition, transDur }] }`.
- Usar `buildTimeline()` también donde hoy se calcula el total (insignias de duración, `findSceneAtTime`) para que textos y voz se ubiquen en el mismo tiempo que el render.

### A2. Reproductor de secuencia
En la barra de la mini pantalla, junto a Play/Mute, agregar los botones "Ver secuencia" y "Detener", una barra de tiempo (`<input type="range">` de 0 a `total`, paso 0.05) y una etiqueta `0.0 / 12.4 s`. Botones sin emojis.

Reloj con `requestAnimationFrame` + `performance.now()`. En cada cuadro:
- **Toma activa:** si cambió, mostrar su medio en el visor con el mismo encuadre que hoy aplica `selectSceneForFrame` (fitMode crop/blur, zoom, panX, panY; reutilizar esa función o extraer la parte de estilos a `applySceneFrame(sc, el)`). Video: `currentTime = sc.start + (t - item.startAt)`, `play()`, silenciado salvo que Mute esté desactivado. Imagen: mostrar `<img>`.
- **Transición (aproximada con CSS, ~transDur):** al entrar una toma con transición, aplicar al envoltorio del medio (`reel-vp-media-wrap`) una clase de animación con `animation-duration = transDur`:
  - `zoomin` → escala de 1.15 a 1
  - `slideleft` / `slideright` / `smoothleft` / `smoothright` → translateX desde ±100% / ±40%
  - `fadewhite` / `fadeblack` → destello blanco/negro (capa encima con opacidad 1→0)
  - `dissolve` / `fade` → opacidad de 0 a 1
  - `none` → sin animación
  Basta con la aproximación: no hace falta mezclar dos videos a la vez.
- **Textos:** se muestran los overlays con `start <= t < end`, con `renderLiveOverlay` y la animación de entrada (`triggerAnim=true`) solo en el cuadro en que aparecen. Si hay varios en la misma posición, mostrar el último.
- **Voz:** para cada frase con `url` (Parte B), un `Audio` que se dispara cuando `t` cruza su `start` (precargar al iniciar). Si hay música seleccionada, reproducirla con el volumen de `reel-music-vol` desde `music.start || 0`.
- **Fin:** al llegar a `total`, detener todo y volver al estado normal (toma activa del paso actual).
- **Barra de tiempo:** arrastrarla salta a ese tiempo (recalcula la toma, `currentTime` y los audios). Mientras no se reproduce, arrastrarla muestra el cuadro estático de ese momento con sus textos.
- "Detener" y el cambio de paso pausan todos los audios y videos y cancelan el `requestAnimationFrame`.
- Mientras se reproduce la secuencia, desactivar el arrastre de encuadre (pan con el mouse).

### A3. Arreglo en el render (servidor)
En la rama xfade de `render()`, la transición `'none'` hoy se convierte en `zoomin` (línea ~614). Cambiar para que `'none'` sea un corte: usar `xfade=transition=fade:duration=0.04`, con el mismo cálculo de `offset` usando `transDur = 0.04`. Reflejar lo mismo en `buildTimeline()` del front (A1).

---

## Parte B — Frases de voz (TTS) con segundo de inicio

### B1. Estado
`S.voiceSegments = [{ id, text, start, url, duration }]`. Guardarlo en `saveState`/`restoreState`.
Migración: si un borrador viejo trae `voiceover` y no trae `voiceSegments`, crear una sola frase `{ text: voiceover, start: 0 }` (sin url). `S.voiceUrl`/`S.voiceDur` quedan obsoletos.

### B2. Interfaz (paso 5, `#reel-voice-controls`)
- Mantener `reel-voiceover` como "Guion completo" (lo sigue llenando "Planificar con IA") y agregar el botón "Dividir en frases": separa por `. ! ?` y salto de línea y crea las frases con inicios consecutivos estimados (`start` anterior + palabras / 2.6 s + 0.3, redondeado a 0.1). Si ya hay frases, pedir confirmación antes de reemplazarlas.
- Lista de frases. Cada fila tiene: textarea con el texto, input numérico "Inicio (s)" (min 0, paso 0.1), etiqueta de duración ("2.3 s" o "sin generar") y los botones "Generar y escuchar" (llama a `/api/reel/voice` con la voz y el estilo elegidos, guarda `url` y `duration` y reproduce) y "Quitar".
- Botón "Agregar frase": nueva frase con `start` = fin de la última frase (o 0).
- Si cambia el texto, la voz o el estilo de una frase, se borran su `url` y su `duration` (hay que regenerarla).
- Aviso (texto chico, no bloquea) si dos frases se pisan en el tiempo o si una termina después del total del video ("el video se alargará").
- Selector de voz, estilo y volumen: siguen siendo globales, como hoy.
- Todo texto del usuario o de la IA que se inserte en el DOM pasa por `esc()`.

### B3. Render
- `renderReel()`: si `reel-use-voice` está marcado, genera las frases que no tienen `url` (una por una, con aviso de progreso) y envía `voice_segments: [{ url, start }]`. Deja de enviar `voice_url`.
- `api.js` `POST /reel/render`: aceptar `voice_segments` (default `[]`) y pasarlo como `voiceSegments`. Mantener `voice_url` por compatibilidad.
- `reelStudioService.render({ voiceSegments = [] , ... })`:
  - Validar: máximo 20 frases, `url` que empiece con `/uploads/reels/`, `start` entre 0 y 120. Si `voiceSegments` viene vacío y hay `voiceUrl`, tratarlo como `[{ url: voiceUrl, start: 0 }]`.
  - Duración de cada frase: la misma fórmula WAV que hoy, o `probeDuration`. `voiceEnd = max(start + dur)`.
  - Extensión del video: `extra = max(0, voiceEnd + 0.5 - totalDuration)`, en lugar de la duración de la voz única.
  - Audio: un `-i` por frase, `[k:a]adelay=<ms>|<ms>,apad[s_k]` por cada una, luego `amix=inputs=N:normalize=0:duration=longest` → `[vmix]`. Con una sola frase, solo `adelay`. Después `volume=voiceVolume`, y desde ahí la misma cadena de hoy (asplit/sidechaincompress con música, o solo voz), con `atrim` al total y fade de salida.
  - Ajustar los índices de entrada (`nextIdx`) para que la música quede después de todas las frases.

---

## Verificación (el ejecutor debe correrla y reportar la salida)
1. `node --check` en `public/js/reelStudio.js`, `src/services/reelStudioService.js` y `src/routes/api.js`.
2. Script de humo en la carpeta temporal del sistema (no en el repo), con `NODE_PATH="C:/Users/aaaa/proyecto manejo redes sociales/node_modules"`:
   - Con el ffmpeg de `ffmpeg-static`, generar en `uploads/reels/tmp/` dos videos de prueba de 3 s (`testsrc`, 1280x720) y dos WAV mono de 24 kHz con `sine` (1.5 s y 2 s).
   - Llamar a `reelStudio.render` con 2 tomas (la segunda con `transition: 'none'`), 1 texto y `voiceSegments` en `start` 0.5 y 2.8. Repetir con la segunda toma en `zoomin`.
   - Verificar que se crea el MP4 y que su duración es aproximadamente la esperada. Borrar los archivos de prueba y los MP4 generados.
   - No llamar a Gemini.
3. Subir los cache busters: `style.css?v=3.5`, `reelStudio.js?v=2.7`.

## Reporte
Archivos tocados, resumen por parte (A1, A2, A3, B1, B2, B3), salida de la verificación y lo que quedó sin verificar.
