# TASK — Panel "Imagen del post" en el Creador (La Campiña) + brief por IA + sugerencia de música

## Objetivo
Al editar un borrador del plan de La Campiña, el Creador muestra un panel "Imagen del post" ya preparado por IA: tema trabajado, ocasión real, público, tipo de foto a subir, titulares, indicaciones de escena (con personas chilenas no estereotipadas, habitando el espacio), UN prompt final para Gemini (maestro + bloque del post) y palabras clave para buscar música. El dueño revisa, ajusta, pone música y agenda. Ver `docs/informe-flujo-borrador-a-post.md` y `docs/decisions.md` (2026-10-16).

Reglas del dueño (obligatorias):
- **Promociones**: solo si la ficha de campaña tiene `details.oferta` con texto. Si está vacío, el brief NO menciona descuentos ni cifras (`promo: null`). Nunca inventar porcentajes, precios ni condiciones.
- **Personas en la escena** (La Campiña): gente chilena de rasgos comunes en Chile, sin estereotipos (ni bastón/caricatura en adultos mayores, ni poses de stock), nunca en primer plano: pequeñas, de espaldas o de perfil, habitando el espacio (caminando, conversando, jugando, comiendo), pocas personas.
- **Titular lo dibuja Gemini**: el bloque del post añade el texto exacto a escribir (titular y subtítulo) con guardas de ortografía.
- **El texto del Prompt Maestro (`buildCampinaImagePrompt`) NO se modifica.**
- La IA propone, el dueño decide: nada se agenda ni publica solo.

Dos partes con archivos disjuntos. Cada ejecutor hace SOLO su parte.

## Contrato de API
- `posts.plan_context` (JSON, ya existe) pasa a poder contener `brief` (objeto) además de `angle, hook, why, occasion, campaign_id, campaign_title`.
- **Brief** = `{ temaTrabajado, ocasion, publico, beneficio, tono, espacioRecomendado, fotoSugerida, musicMood, musicKeywords: [string], promo: null | { oferta, condiciones, dias }, notasPersonas }`.
- `POST /api/ai/post-brief` body `{ postId, force? }` → `{ success, data: { brief } }`. Lee el post (title, content, scheduled_at, account_name, plan_context), la campaña (`campaign_id`) y devuelve el brief; si ya existe `plan_context.brief` y no hay `force`, lo devuelve sin llamar a IA. Persiste el brief en `posts.plan_context` (merge, conservando las demás claves). 404 si el post no existe, 400 si falta `postId`.
- `POST /api/ai/campina-prepare-post` body `{ postId, imageUrl?, sceneHint?, force? }` → `{ success, data: { brief, headlines: [{hero,keyword,subline,angle}], hero, subline, keyword, scene: { spaceType, audienceFocus, reasoning:[..], sceneDirective }, masterImagePrompt, postBlock, fullPrompt } }`. Orden: brief (reusa/crea) → en paralelo `generateCampinaHeadlines` y `buildCampinaSceneDirective` → arma maestro y bloque. Si falla escena o titulares, devolver igual lo que sí salió (`scene: null`/`headlines: []`) con `warnings: [string]`; solo 500 si falla el brief y no hay nada que devolver.
- `POST /api/ai/campina-compose-prompt` body `{ theme, targetDate, hero, subline, scene, typographyStyle?, brandTreatment?, colorPalette?, posterReference?, respectBackground? }` → `{ success, data: { masterImagePrompt, postBlock, fullPrompt } }`. SIN llamadas a IA (determinista) para recalcular al editar titular/escena.
- `GET /api/music/search?q=&provider=openverse` devuelve `{ source:'openverse_api', results:[...] }` con el mismo formato de pista que Audius/Jamendo.
- `fullPrompt` = `masterImagePrompt` + `\n\n` + `postBlock`. `postBlock` = `sceneDirective` (si hay) + `\n\n` + bloque de texto exacto (ver Parte A punto 5).

---
# PARTE A — Backend
## Archivos permitidos
- `src/services/chileCalendar.js` (NUEVO), `src/services/aiService.js`, `src/services/musicService.js`, `src/routes/api.js`

## Cambios exactos
1. **`chileCalendar.js`** (singleton `module.exports = new ChileCalendar()`), método `describe(dateInput)` que recibe ISO/Date, usa zona `America/Santiago` y devuelve `{ dateLabel, season, nearHolidays: [{ name, date, daysAway }], longWeekend: boolean, note }` con feriados de Chile: 1 ene, Viernes y Sábado Santo (calcular Pascua con el algoritmo gregoriano anónimo), 1 may, 21 may, 20 jun (Día de los Pueblos Indígenas, aprox.), 29 jun, 16 jul, 15 ago, 18 y 19 sep, 12 oct, 31 oct, 1 nov, 8 dic, 25 dic; además fechas "de ocasión": 24 dic Nochebuena, 31 dic Año Nuevo, Día de la Madre (2º domingo de mayo), Día del Padre (3er domingo de junio), Día del Niño (2º domingo de agosto), Día del Abuelo/Adulto Mayor: 26 de julio (Día de los Abuelos) y 1 de octubre (Día Internacional de las Personas Mayores). `nearHolidays` = los que caen entre -2 y +21 días de la fecha. `season`: hemisferio sur (verano dic-feb, otoño mar-may, invierno jun-ago, primavera sep-nov). `longWeekend` true si la fecha es viernes/lunes junto a un feriado o fin de semana con feriado adyacente (lógica simple, no exhaustiva). Sin dependencias nuevas.
2. **`aiService.buildPostBrief({ post, campaign })`** (método de la clase): arma el prompt con: título, copy actual del post (`content`), fecha (`chileCalendar.describe(post.scheduled_at)` como hechos), `plan_context` (angle, hook, why), la campaña completa (title, directive, details: oferta, publico, dias, condiciones, cta), y el conocimiento del recinto (`getCampinaKnowledgePrompt()`). Usa `this.generateJSON({ prompt, temperature: 0.6 })`. Instrucciones: razonar por pasos y devolver el brief del contrato; `temaTrabajado` = 1 o 2 frases (qué se comunica y a quién, NO repetir el título); `ocasion` = texto corto y concreto basado SOLO en los hechos del calendario (nunca "fin de semana normal" vacío: si no hay feriado cercano, usar estación + contexto del post); `publico` y `beneficio` deducidos; `espacioRecomendado` ∈ pastizal/áreas verdes, cabaña, suite, quincho, sendero de pinos, terraza, piscina (piscina solo si la fecha cae entre dic y Semana Santa), otro; `fotoSugerida` = frase en segunda persona ("Sube una foto de ... con encuadre ..."); `musicMood` y `musicKeywords` (3 a 5 palabras clave EN INGLÉS más 1 o 2 en español, para buscar música libre: ej. "acoustic","warm","family","gentle"); `notasPersonas` = cómo mostrar personas respetando las reglas del dueño del encabezado de este TASK. `promo`: construirlo en CÓDIGO, no con IA: si `campaign?.details?.oferta` es string no vacío → `{ oferta, condiciones: details.condiciones||'', dias: details.dias||'' }`, si no `null`; pasarle al modelo solo esos datos y la instrucción de no inventar nada más. Validar en código: strings recortados, `musicKeywords` array de ≤6 strings, defaults seguros si falta algo (nunca lanzar por un campo opcional).
3. **`aiService.buildCampinaSceneDirective`**: añadir al prompt (sin cambiar su estructura de 5 pasos) las reglas de personas del dueño (ver encabezado: rasgos comunes chilenos, sin estereotipos, no primer plano, habitando el espacio) y aceptar un parámetro nuevo opcional `brief` (objeto): si viene, inyectar `notasPersonas`, `publico`, `espacioRecomendado`, `temaTrabajado` como contexto. Mantener compatibilidad con llamadas actuales.
4. **`aiService.generateCampinaHeadlines`**: aceptar parámetro opcional `brief` y, si viene, inyectar `temaTrabajado`, `publico`, `beneficio`, `ocasion`, y `promo` solo si no es null (con la regla "no inventes cifras que no estén en promo"). Compatibilidad con llamadas actuales.
5. **`aiService.buildCampinaPostBlock({ scene, hero, subline })`** (determinista): devuelve `[scene?.sceneDirective || '', bloqueTexto].filter(Boolean).join('\n\n')` donde `bloqueTexto` es:
```
TEXTO EXACTO EN LA IMAGEN (cópialo letra por letra, con tildes y ñ, sin cambiar nada):
- Titular: "<hero>"
- Subtítulo: "<subline>"
- Identidad discreta: "CABAÑAS LA CAMPIÑA • ALGARROBO"
No escribas ningún otro texto, número, logo ni marca de agua. Si una palabra queda con error ortográfico o letras deformes, corrígela antes de entregar. Entrega UNA sola imagen 4:5 (1080x1350).
```
   y `buildCampinaFullPrompt({ masterImagePrompt, postBlock })` = `master + '\n\n' + postBlock`.
6. **`api.js`**: rutas `/ai/post-brief`, `/ai/campina-prepare-post`, `/ai/campina-compose-prompt` junto a las de `campina-*`, patrón `try/catch` con `{ success, data|error }`, 400/404 según contrato. `campina-prepare-post` obtiene la campaña con `campaignService.get(id)` (puede ser null) y llama `buildCampinaImagePrompt` con `heroHeadline/sublineHeadline` elegidos (opción 0 de titulares, registrando con `recordCampinaRecentHero` solo ese), `theme` = `brief.temaTrabajado`, `targetDate` = `brief.ocasion`. `compose-prompt` llama `buildCampinaImagePrompt` + `buildCampinaPostBlock` + `buildCampinaFullPrompt`. Validar tamaños (strings ≤ 4000 caracteres) y que `imageUrl` empiece por `/uploads/` (si no, ignorarlo).
7. **`musicService.searchOpenverse({ query, limit })`** y soporte `provider === 'openverse'` en `searchAllSources`: `GET https://api.openverse.org/v1/audio/` con `params: { q, license: 'cc0,pdm', page_size: limit }`, timeout 8000, sin clave. Mapear cada resultado al formato de pista existente: `id: 'ov_' + id`, `title`, `artist: creator || 'Dominio público'`, `streamUrl: url`, `durationSec: Math.round((duration||0)/1000)`, `artworkUrl: thumbnail||''`, `license: 'CC0 / Dominio público'`, `badge: 'Openverse'`, `categoryLabel: 'Openverse (dominio público)'`, `mood: (genres||[]).join(', ')||'Libre'`. Si `url` falta, descartar. Error de red → `{ source:'openverse_api', error, results: [] }`. NO activarlo por defecto (solo con `provider=openverse`); no cambiar el orden actual de fuentes.
8. Mantener intactos: texto de la plantilla de `buildCampinaImagePrompt`, rutas existentes, `suggestImagePrompt`.

## Fuera de alcance (Parte A)
- No tocar `public/`, `db.js` (no hacen falta columnas nuevas), ni el texto de plantillas de prompts existentes.
- No commit ni push. No levantar `server.js`.

## Verificación (Parte A)
1. `node --check` en cada JS tocado/nuevo.
2. Humo con `NODE_PATH="C:/Users/aaaa/proyecto manejo redes sociales/node_modules"`: (a) `chileCalendar.describe('2026-12-28T11:00:00-03:00')` incluye Año Nuevo en `nearHolidays` y `season==='verano'`; `describe('2026-10-02')` incluye Día Internacional de las Personas Mayores (1 oct, `daysAway` negativo) o equivalente coherente. (b) `buildCampinaPostBlock` y `buildCampinaFullPrompt` devuelven strings con `TEXTO EXACTO EN LA IMAGEN` y el hero entre comillas. (c) `git diff` demuestra que el template de `buildCampinaImagePrompt` no cambió. (d) `searchOpenverse({query:'acoustic',limit:3})` con red real: reportar resultados o error (no inventar). (e) Express mínimo con auth simulado: `post-brief` sin `postId` → 400, con `postId` inexistente → 404; `campina-compose-prompt` con datos válidos → `fullPrompt` que contiene el hero; `campina-prepare-post` sin clave Gemini → respuesta controlada, no cuelgue. Insertar y borrar un post de prueba si se necesita.

---
# PARTE B — Frontend
## Archivos permitidos
- `public/js/composer.js`, `public/index.html`

## Cambios exactos
1. **Panel "Imagen del post"** en `index.html`, como tarjeta nueva `composer-post-image-panel` (`display:none` por defecto) justo después de la tarjeta `composer-gemini-prompt-card`. Estructura (ids exactos, textos en español de Chile, sin emojis en botones):
   - Encabezado "Imagen del post" + subtítulo "Preparado por IA. Revisa y ajusta antes de generar en Gemini." + botón `btn-pip-prepare` "Preparar post" + botón `btn-pip-regen-brief` "Rehacer análisis".
   - `pip-loading` (texto de progreso) y `pip-error`.
   - Bloque brief (editable donde se indica): `pip-tema` (input, "Tema o enfoque"), `pip-ocasion` (input), `pip-publico` (input de solo lectura), `pip-foto-hint` (párrafo destacado "Foto a subir: ...").
   - Titulares: `pip-hero` (input), `pip-subline` (input), `pip-headline-pills` (contenedor de pastillas), botón `btn-pip-more-headlines` "Otras ideas de titular".
   - Escena: `pip-scene-prompt` (textarea editable, rows 5), `details` `pip-reasoning` "Ver razonamiento" con `pip-reasoning-list`, etiqueta `pip-scene-meta`.
   - Prompt final: `pip-full-prompt` (textarea editable, rows 8, fuente mono), botones `btn-pip-copy` "Copiar prompt completo", `btn-pip-open-gemini` "Abrir Gemini".
   - Música: contenedor `pip-music-block` con título "Música sugerida", `pip-music-mood` (texto) y `pip-music-chips` (botones con palabras clave).
2. **Lógica en composer.js**:
   - Detección Campiña: reutilizar el mecanismo de marca activa que ya usa `adaptComposerToActiveBrand` (grep); además, si `post.plan_context` existe y la cuenta del borrador coincide con /campi/i, es Campiña. Solo si es Campiña se muestra el panel y se OMITE la llamada automática a `suggestImagePromptForComposer()` en `loadPostIntoComposer` (la tarjeta genérica queda oculta para esos borradores). Para otras marcas todo queda como hoy.
   - Al abrir un borrador Campiña (`loadPostIntoComposer`): mostrar el panel; si `plan_context.brief` existe, pintarlo; si no, llamar `POST /api/ai/post-brief {postId}` automáticamente (un solo intento, sin bloquear la UI) y pintar. Rellenar también `campina-theme` ← `brief.temaTrabajado` y `campina-date` ← `brief.ocasion` (esto sí sobrescribe lo prellenado antes con el título crudo). Guardar `window._postBrief`.
   - Botón `btn-pip-prepare`: toma foto = `ComposerState.mediaFiles[0]` si empieza por `/uploads/`; POST `/api/ai/campina-prepare-post {postId, imageUrl?, sceneHint: ''}`; pinta hero, subline, pastillas (clic en pastilla → rellena hero/subline y llama compose), escena, razonamiento y `fullPrompt`. Mientras corre: botón deshabilitado y "Preparando...". Mostrar `warnings` en `pip-error` sin bloquear.
   - Editar `pip-hero`, `pip-subline` o `pip-scene-prompt` → debounce 500 ms → `POST /api/ai/campina-compose-prompt {theme, targetDate, hero, subline, scene:{sceneDirective: <textarea>}, typographyStyle, brandTreatment, colorPalette, posterReference}` (leer los selects `campina-*` existentes) → actualizar `pip-full-prompt`. Si el usuario editó a mano `pip-full-prompt`, NO sobrescribirlo salvo que pulse "Preparar post" de nuevo (flag).
   - `btn-pip-more-headlines`: `POST /api/ai/campina-headlines {theme, targetDate, caption, planContext: window._draftPlanContext, brief: window._postBrief}` y repinta pastillas.
   - `btn-pip-regen-brief`: `post-brief` con `force:true`.
   - Copiar: copia `pip-full-prompt`; toast "Prompt completo copiado. Pégalo en Gemini con tu foto". Abrir Gemini: copia y `window.open('https://gemini.google.com','_blank','noopener')`.
   - Música: pinta `musicMood` y una pastilla por `musicKeywords`. Clic en pastilla: si la sección de música existe (`story-music-section`), marcar `chk-story-music-enabled` si no lo está (disparar `change`), poner el texto en `music-search-input` y `jamendo-search-input` (si existen) y disparar el evento `input`/`keydown Enter` que ya usan sus listeners en `storyMusic.js` (leerlo con grep para usar el mismo mecanismo; NO editar `storyMusic.js`), y hacer `scrollIntoView` a la sección. Añadir además, junto al buscador de música, NO nada más (el proveedor Openverse se expone solo por API en esta fase; documentarlo en el reporte).
   - Todo texto de la IA que se inserte con `innerHTML` pasa por `escapeHtml` (ya existe en el archivo). Preferir `textContent`/`.value`.
   - Limpiar el panel y `window._postBrief` en `resetComposerFormState` y `resetAiModalState`.
   - Al cargar un borrador distinto, vaciar `pip-*` antes de pintar.
3. Subir versión de caché: en `index.html` cambiar `js/composer.js?v=2.6` por `?v=2.7`.

## Fuera de alcance (Parte B)
- No tocar `src/`, `storyMusic.js`, la sección Kmarket/Agendio ni el modal Asistente IA (sigue funcionando como está).
- No commit ni push.

## Verificación (Parte B)
1. `node --check public/js/composer.js`.
2. Cruce con grep: todo id `pip-*`/`btn-pip-*` usado en JS existe en `index.html` y viceversa.
3. Listar lo no probado en navegador.

## Criterio de terminado
Reporte con: estado, archivos tocados, salida literal de cada verificación, desviaciones y lo no verificado.
