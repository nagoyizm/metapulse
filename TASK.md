# TASK — Reels: la IA mira y analiza los clips

Respaldo: etiqueta git `reels-v2`. Ejecutor: NO hacer commit. Respetar los saltos de línea de cada archivo. No leer completos los archivos grandes (`aiService.js` ~3.700 líneas): usar grep y rangos.

## Archivos permitidos
- `src/services/aiService.js` (solo agregar un método nuevo)
- `src/services/reelStudioService.js`
- `src/routes/api.js` (solo rutas `/reel/*` nuevas)
- `public/js/reelStudio.js`, `public/css/style.css`, `public/index.html` (paso 2 y cache busters)

## 1. Llamada multimodal genérica (`aiService.js`)
Agregar `async generateJSONWithImages({ prompt, images = [], temperature = 0.4, maxOutputTokens = 4096 })`:
- `images` = `[{ mime_type, data /* base64 */, label? }]`. Cada imagen va como parte `inline_data`, precedida de una parte de texto con su `label` si lo trae (ej. "Cuadro en el segundo 4.0").
- Recorre `sanitizeGeminiModels(getSetting('ai_model'))` como en `chooseCampinaArtDirection` (~línea 2840): salta de modelo ante error o 503, `responseMimeType: 'application/json'`, ignora partes con `thought`, limpia los ```json y aplica las mismas protecciones que `generateJSON` (rechaza `finishReason` MAX_TOKENS y `looksLikeLeakedReasoning`). Timeout de 60 s.
- Devuelve `{ data, model }` igual que `generateJSON`. Sin API key → error claro.

## 2. Análisis de un clip (`reelStudioService.analyzeClip({ url, brand, goal })`)
- **Caché:** `uploads/reels/<nombre>.analysis.json`. Si existe y el archivo de medios no cambió (mismo tamaño), devolverlo sin llamar a la IA. `force: true` lo ignora.
- **Cuadros:**
  - Video: duración con `probeDuration`. `n = min(12, max(4, ceil(dur)))` cuadros repartidos uniformemente (evitar el primer 0.2 s y el último). Por cada uno: `ffmpeg -ss <t> -i <archivo> -frames:v 1 -vf scale=512:-2 -q:v 5` a JPEG en `uploads/reels/tmp/`. Leer como base64 y borrarlos.
  - Foto: la imagen reducida a 768 px con `sharp`.
- **Prompt** (español, pide JSON estricto). Incluye la marca con las mismas `brandRules` de `plan()` (extraerlas a una función `brandRulesFor(brand)` y usarla en ambos), el objetivo si viene y la duración. Pide:
```json
{
  "description": "qué se ve, 1-2 frases concretas (sujeto, acción, lugar)",
  "subject": "sujeto principal",
  "mood": "cálido | enérgico | tranquilo | apetitoso | ...",
  "shotType": "primer plano | plano medio | general | detalle | ...",
  "highlights": [ { "start": 6.0, "end": 9.0, "label": "primer plano del ramen humeante", "score": 9 } ],
  "hook": { "start": 6.0, "end": 7.5, "why": "..." },
  "framing": { "panX": 0.5, "panY": 0.45, "zoom": 1.0, "fitMode": "crop" },
  "issues": ["movido entre 2 y 3 s", "oscuro al inicio"],
  "textIdeas": ["RAMEN EN 3 MINUTOS", "..."]
}
```
  Reglas para la IA: `highlights` de 1.5 a 4 s, máximo 4, dentro de la duración y ordenados por `score` (1-10). `framing.panX`/`panY` (0-1) indican dónde está el sujeto, para recortar a 9:16; `fitMode: "blur"` solo si es un paisaje amplio que no se debe recortar. No inventar lo que no se ve. Cumplir las reglas de la marca (ej. La Campiña: nada de tinajas ni jacuzzis aunque parezca que hay).
- **Validar y normalizar:** recortar números a rango, quitar highlights fuera de la duración, máximo 4 `textIdeas` de 2-6 palabras. Guardar la caché y devolver `{ ...analysis, duration, analyzedAt, model }`.

## 3. Sugerencias del conjunto (`reelStudioService.reviewClips({ brand, goal, template, targetSeconds, clips })`)
`clips` = `[{ index, description, analysis }]` (solo texto, sin imágenes). La IA devuelve:
```json
{
  "hookClip": 2,
  "recommendedTemplate": "review | top3 | atmosphere | promo",
  "recommendedSeconds": 12,
  "missingShots": ["un plano de cierre con el local o el logo", "..."],
  "tips": ["el clip 1 está oscuro: úsalo poco", "..."],
  "goalIdea": "objetivo sugerido si el dueño no escribió uno"
}
```
Usar los ids reales de `TEMPLATES`. Validar.

## 4. Plan usando el análisis (`plan()`)
- Si un clip trae `analysis`, en `described` agregar `analysis: { description, highlights, hook, shotType, mood, issues }` y usar `analysis.description` cuando el dueño no escribió descripción. La descripción del dueño siempre manda sobre la de la IA.
- Agregar al prompt: "Si un clip trae highlights, elige start/length dentro de ellos; la toma 1 usa el hook del clip más fuerte; evita los tramos con issues".
- Post-proceso: si la toma de un clip con `analysis.framing` queda con zoom 1 y pan 0.5 por defecto, aplicarle `framing` (panX, panY, zoom, fitMode).

## 5. Rutas (`api.js`)
- `POST /reel/analyze-clip` `{ url, brand, goal, force }` → `analyzeClip`. Validar que `url` empiece con `/uploads/reels/`, si no, 400.
- `POST /reel/review-clips` `{ brand, goal, template, targetSeconds, clips }` → `reviewClips`.
- `POST /reel/plan`: pasar el `analysis` de cada clip si viene.
Mismo patrón `try/catch` y `{ success, data|error }`.

## 6. Interfaz (paso 2, Clips)
- Casilla "Analizar con IA al subir" (marcada por defecto; se guarda en `localStorage`). Al terminar de subir, analiza los clips nuevos de a uno (secuencial, para no topar el límite gratis), con estado en la tarjeta: "Analizando...", "Analizado" o "Error: reintentar".
- Botón "Analizar todos con IA" (salta los ya analizados) y, en cada tarjeta, "Volver a analizar" (`force`).
- En cada tarjeta, con el análisis listo:
  - Si la descripción está vacía, llenarla con `analysis.description`. Si no, mostrar "Sugerencia: ..." con el botón "Usar".
  - Chips con los highlights (`6.0–9.0 s · primer plano del ramen`). Clic → previsualiza ese tramo en la mini pantalla (reusar `previewClip` saltando a `start`). Botón chico "Usar como toma" → agrega una toma en el paso 3 con ese `start`/`length` y el `framing`.
  - El hook marcado con una insignia "Gancho".
  - `issues` como avisos chicos en ámbar.
  - `textIdeas` como chips. Clic → agrega un texto en el paso 4 (de 0 a 2.5 s si no hay textos; si no, después del último).
- Panel "Sugerencias de la IA" sobre "Planificar con IA", con el botón "Revisar mis clips" → `/reel/review-clips`. Muestra gancho sugerido, fórmula y duración recomendadas (con botón "Aplicar", que los fija en el paso 1), planos que faltan y consejos. Si el objetivo está vacío, ofrece `goalIdea` con "Usar".
- `planWithAI()` envía el `analysis` de cada clip.
- El análisis se guarda dentro de `S.clips[i].analysis` (persiste con el borrador).
- Todo texto de la IA pasa por `esc()` antes de entrar al DOM. Botones sin emojis.
- Cache busters: `style.css` y `reelStudio.js` +1 respecto al valor que tengan en ese momento.

## Verificación (el ejecutor la corre y reporta)
1. `node --check` en todos los JS tocados.
2. Humo con `NODE_PATH="C:/Users/aaaa/proyecto manejo redes sociales/node_modules"`, contra la BD local (que tiene la API key):
   - Buscar un clip real en `C:/Users/aaaa/proyecto manejo redes sociales/uploads/reels/` (mp4/mov). Si no hay, generar un `testsrc` de 8 s en `uploads/reels/tmp/`.
   - Llamar UNA vez a `analyzeClip` (llamada real a Gemini) e imprimir el JSON. Llamarlo de nuevo y confirmar que sale de la caché (sin llamada).
   - Llamar una vez a `reviewClips` con ese análisis e imprimir el resultado.
   - Borrar la caché `.analysis.json` y los archivos de prueba creados (no los clips reales).
3. Confirmar que no quedan JPEG temporales en `uploads/reels/tmp/`.

## Reporte
Archivos tocados, resumen por punto (1 a 6), el JSON real de `analyzeClip` y `reviewClips`, salida de la verificación y lo que quedó sin verificar.
