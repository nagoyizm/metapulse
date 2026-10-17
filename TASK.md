# TASK — Dirección de arte con IA (paletas curadas) + datos de contacto estampados por MetaPulse

## Objetivo
1. El dueño rechazó la combinación "texto verde brillante sobre trazo café" (paleta `tierra_bosque` + acabado `brush_stroke`). La IA debe ELEGIR con razonamiento la paleta, tipografía y acabado (mirando la foto subida cuando exista) desde una biblioteca curada de combinaciones armónicas para publicidad de alojamientos, mostrarlas en el panel y permitir cambiarlas.
2. Casilla opcional "Incluir datos de contacto": MetaPulse (no Gemini) estampa una línea sutil y elegante abajo de la imagen ya generada, con tipografía limpia y ligera de amplio espaciado (como el "CABAÑAS LA CAMPIÑA • ALGARROBO" que dibuja Gemini). Usa los datos de la pestaña Marca (`profile.contact.whatsapp`, `web`, `direccion`); lo que esté vacío se omite.

Reglas del dueño: la IA propone, el dueño decide. El estampado es reversible (se conserva la imagen original). El texto base del Prompt Maestro se conserva; solo se permiten los añadidos indicados en A3. Versiones de respaldo ya etiquetadas: `prompt-maestro-v1`, `prompt-maestro-v2`.

Dos partes con archivos disjuntos. Cada ejecutor hace SOLO su parte.

## Contrato de API
- `POST /api/ai/post-brief` y `POST /api/ai/campina-prepare-post` (existentes) añaden `contactAvailable: { whatsapp: boolean, web: boolean, direccion: boolean }` en `data` (a partir de `brandProfileService.getProfile(post.account_name)?.contact`).
- `campina-prepare-post` añade `artDirection: { typographyStyle, brandTreatment, colorPalette, posterReference, paletteName, swatches: [hex,...], styleName, treatmentName, fontFamilies: [string], reason }`.
- `POST /api/ai/campina-art-direction` body `{ theme, targetDate, brief?, imageUrl? }` → `{ success, data: { ...artDirection } }` (rehacer solo la dirección de arte).
- `GET /api/ai/campina-art-options` → `{ success, data: { styles:[{id,name}], treatments:[{id,name}], palettes:[{id,name,swatches:[hex]}], posterRefs:[{id,name}] } }` (sin IA; para poblar los selectores del panel).
- `POST /api/media/stamp-contact` body `{ imageUrl, accountName, fields?: { whatsapp?: boolean, web?: boolean, direccion?: boolean } }` → `{ success, data: { url, filename, lines: [string] } }`. 400 si `imageUrl` no empieza por `/uploads/`, si se sale de `uploads` (path traversal), si no existe, o si la marca no tiene ningún dato de contacto (`"La marca no tiene datos de contacto cargados en la pestaña Marca."`). `fields` ausente = usar todos los disponibles.
- `campina-compose-prompt` (existente) ya acepta `typographyStyle, brandTreatment, colorPalette, posterReference`; el panel los enviará desde sus selectores.

---
# PARTE A — Backend
## Archivos permitidos
- `src/services/aiService.js`, `src/services/imageService.js`, `src/routes/api.js`
- Ya existen, NO tocar: `assets/fonts/Lato-Regular.ttf`, `assets/fonts/Lato-Bold.ttf` (OFL).

## Cambios exactos
### A1. Biblioteca curada de paletas (`getCampinaColorPalettes`)
Añadir al final del arreglo (no borrar las existentes) estas paletas, con los campos de las existentes (`id, name, shortName, vibe, primaryColor, accentColor, forbiddenColors, artDirection`) más `swatches` (array de hex: texto, acento, profundo/sombra) y `harmony` (frase):
- `pino_crema_terracota` — texto crema `#F6EEDF`, acento terracota `#B5522E`, profundo pino `#1F3D2B`. Para bosque, quinchos, otoño, descanso general.
- `lino_carbon_ocre` — texto lino `#F2EBDD`, acento ocre mineral `#B88A44`, profundo carbón `#2A2724`. Boutique, suites, parejas.
- `atardecer_ambar` — texto crema `#FFF4E0`, acento ámbar quemado `#D9822B`, profundo chocolate `#4A2C1D`. Asado, tardes, fuego.
- `salvia_durazno` — texto blanco `#FFFFFF`, acento durazno `#F2A58E`, profundo salvia `#3F5A48`. Primavera, familia, jardines.
- `azul_profundo_arena` — texto blanco espuma `#F8FAFC`, acento arena `#E3C9A0`, profundo azul `#1D3B53`. Verano, costa, piscina.
- `bosque_niebla_laton` — texto niebla `#F3F5F2`, acento latón apagado `#A98B5A`, profundo verde `#24402F`. Naturaleza, senderos, calma.
- `vino_crema_rosa` — texto crema `#FBF3E8`, acento rosa viejo `#C98E8A`, profundo burdeos `#6B2737`. Aniversarios, parejas, San Valentín.
En todas: `forbiddenColors` debe prohibir verdes brillantes/neón (incluido `#22C55E`), amarillo limón, y cualquier color fuera de los tres de `swatches` más sus tintes/sombras. `harmony` = "Regla 60/30/10: 60% foto, 30% color de texto, 10% acento; el trazo o ribete usa el acento o el profundo, nunca un verde saturado sobre un tono café/terracota".
Además, **corregir `tierra_bosque`**: cambiar `accentColor` a `'Terracota apagado (#B5522E) y Verde pino profundo (#1F3D2B)'` (quitar `#22C55E`) y añadir a su `forbiddenColors`: "PROHIBIDO verde brillante o saturado en el texto o sobre trazos café/terracota".
Actualizar `detectCampinaColorPalette` para que su valor por defecto (cuando no hay coincidencia) sea `pino_crema_terracota` en vez de `tierra_bosque`, y que pareja/suite → `lino_carbon_ocre`, primavera → `salvia_durazno`, verano/costa/piscina → `azul_profundo_arena`, asado/fuego → `atardecer_ambar`. Mantener las reglas de Año Nuevo, Navidad, Patrias e invierno ya existentes.

### A2. Tipografías con familias reales
Añadir a cada estilo de `getCampinaTypographyStyles()` el campo `fontFamilies` (2 a 3 nombres reales de Google Fonts, el primero es el principal). Sugerido: `rustic_timber` ['Bebas Neue','Oswald','Barlow Condensed']; `kinfolk_luxury` ['Cormorant Garamond','Playfair Display','Lora']; `natgeo_adventure` ['Anton','Oswald','League Gothic']; `botanical_minimal` ['Montserrat','Josefin Sans','Lato']; `patria_heritage` ['Alfa Slab One','Rye','Bevan']; `handcraft_script` ['Caveat Brush','Kaushan Script','Montserrat']; `retro_travel_70s` ['Chewy','Fredoka','Righteous']; `art_deco_geometric` ['Poiret One','Josefin Sans','Limelight']; `celebration_modern` ['Poppins','Playfair Display Italic','Montserrat']; `auto` ['']. 
Para los acabados (`getCampinaBrandTreatments`), en el `artDirection` de `brush_stroke` añadir al final: " El trazo debe ser del mismo tono del acento de la paleta o de su color profundo, jamás un verde saturado sobre un trazo café/terracota; el texto principal mantiene alto contraste con el trazo."

### A3. Añadidos permitidos al texto del Prompt Maestro (`buildCampinaImagePrompt`), solo estos dos
- En el bloque `d) ESTILO TIPOGRÁFICO BASE` tras `${matchedStyle.description}` añadir una línea: `     Familias tipográficas de referencia: ${(matchedStyle.fontFamilies || []).filter(Boolean).join(' / ') || 'sans-serif editorial'} (o equivalentes muy cercanas).`
- En la sección 3 (dirección cromática), al final de `${colorPaletteSection}`, añadir una línea: `- REGLA DE ARMONÍA: usa SOLO los colores indicados y sus tintes; máximo 3 colores en el rótulo (60/30/10); el trazo y los ribetes toman el acento o el profundo de la paleta; prohibido un verde saturado sobre un tono café/terracota.`
No cambiar nada más de la plantilla. El diff de esa función debe mostrar solo esas dos líneas nuevas (más lo que ya cambió antes de esta tarea: nada).

### A4. `aiService.chooseCampinaArtDirection({ theme, targetDate = '', brief = null, imageUrl = '' })`
- Extraer del método `buildCampinaSceneDirective` la carga y validación de imagen local a un helper `loadUploadImageInline(imageUrl)` (devuelve `{ mime_type, data }` o `null` si no hay imagen; lanza error si la ruta es inválida), y reutilizarlo en ambos métodos SIN cambiar el comportamiento del existente.
- Prompt a Gemini (con la imagen como `inline_data` si hay; mismo patrón axios + `sanitizeGeminiModels` que `buildCampinaSceneDirective`; sin imagen usar `generateJSON`; `temperature: 0.8`): rol de director de arte de publicidad de alojamientos. Entregar la lista de ids disponibles de cada catálogo con su `vibe`/nombre y, para paletas, sus hex. Instrucciones de razonamiento: (1) evaluar foto (si hay): color dominante, luminosidad y espacio libre donde iría el titular; (2) considerar tema, ocasión/estación, público, campaña; (3) elegir `colorPalette` cuyo color de texto contraste ≥ 4.5:1 con la zona del titular de la foto; (4) elegir `typographyStyle`, `brandTreatment` y `posterReference` coherentes con la paleta; (5) verificar armonía: máx. 3 colores, nada de verdes saturados sobre cafés; (6) variar: evitar repetir las últimas 5 paletas usadas (guardarlas en `settings` con `campina_recent_palettes`, tolerar JSON inválido, igual patrón que `campina_recent_heroes`) salvo que sea claramente la única buena. Salida JSON `{ typographyStyle, brandTreatment, colorPalette, posterReference, reason }` donde `reason` = 1 o 2 frases en español explicando la elección (mencionar la foto si se vio).
- Validar en código que cada id exista en su catálogo; si no, reemplazarlo por la selección determinista (`resolveCampinaVisualSelection` con los detectores). Si la IA falla, devolver la selección determinista con `reason: 'Selección automática por reglas (la IA no respondió).'`. Nunca lanzar por esto.
- Devolver además `paletteName`, `swatches` (del catálogo, o extraídos con regex `#[0-9A-Fa-f]{6}` de `primaryColor`+`accentColor` si falta), `styleName`, `treatmentName`, `fontFamilies`.
- Registrar la paleta elegida en `campina_recent_palettes` (máx. 5).

### A5. Rutas
- `campina-prepare-post`: lanzar `chooseCampinaArtDirection` en paralelo con titulares y escena (mismo `Promise.allSettled`; si falla, warning y selección por reglas), usar sus ids en la llamada a `buildCampinaImagePrompt`, devolver `artDirection` y `contactAvailable`.
- `post-brief`: añadir `contactAvailable` a la respuesta (sin persistirlo).
- Nuevas: `/ai/campina-art-direction` y `/ai/campina-art-options`.
- `contactAvailable` se calcula con `brandProfileService.getProfile(post.account_name)?.contact` (strings no vacíos tras trim).

### A6. `imageService.stampContactLine({ inputImagePath, lines, fontPath })` y ruta `/media/stamp-contact`
- Construir `lines` en la ruta: `whatsapp` → `WhatsApp ${valor}`; `web` → valor sin `https?://` ni `www.` ni `/` final; `direccion` → valor tal cual; omitir vacíos. Respetar `fields`. Si queda vacío → 400 (mensaje del contrato). Unir con `  •  `. Todo en MAYÚSCULAS (`toLocaleUpperCase('es-CL')`) para ser consistente con la identidad de Gemini.
- Resolver la imagen con la misma validación de `/uploads/` y path traversal que `loadUploadImageInline` (resolver con `path.resolve`, dentro de `<repo>/uploads`, existente, ≤ 15 MB). Leer metadatos con `sharp`.
- Render del texto con `sharp({ text: { text: '<span foreground="#RRGGBB" letter_spacing="2200">...</span>', font: 'Lato', fontfile: <abs>/assets/fonts/Lato-Regular.ttf, rgba: true, dpi: 300 } })`, generado al DOBLE de tamaño y reducido con `resize` (kernel lanczos3) para evitar bordes de color. NO usar texto SVG (el servidor Linux no tiene fuentes del sistema). Escapar `&`, `<`, `>` del texto antes de armar el markup.
- Tamaño: altura de letra ≈ 1.7% del alto de la imagen; ancho máximo del texto 86% del ancho de la imagen (si no cabe en una línea, reducir hasta un 70% del tamaño y, si aún no cabe, dividir en dos líneas por el separador). Posición: centrado, base del texto a 4.2% del borde inferior (dentro del margen de seguridad).
- Color: calcular la luminosidad media de la franja inferior (12% del alto) con `sharp.stats()` sobre un `extract`; si luminosidad < 0.55 → texto `#F6EEDF`; si no → `#1F1A17`. Añadir un velo degradado muy sutil sólo en la franja inferior (de transparente a 0.35 de opacidad en el color contrario al texto, p. ej. negro si texto claro) con `composite` de un `Buffer` SVG de `linearGradient` SIN texto, y un filete horizontal de 1 px al 40% de opacidad, del color del texto, 1.6% por encima del texto, de ancho 14% centrado. Todo sutil, sin cajas ni paneles.
- Guardar como `uploads/contact-<timestamp>.jpg` (calidad 92, `mozjpeg`) con las MISMAS dimensiones de la original; nunca sobrescribir la original. Devolver `{ url: '/uploads/contact-....jpg', filename, lines }`.

## Fuera de alcance (Parte A)
- No tocar `public/`, `db.js`, `package.json`, ni otros textos de la plantilla del Prompt Maestro. No instalar dependencias. No commit ni push. No levantar `server.js`.

## Verificación (Parte A)
1. `node --check` en los 3 archivos.
2. Humo con `NODE_PATH="C:/Users/aaaa/proyecto manejo redes sociales/node_modules"`:
   a. `getCampinaColorPalettes()` incluye las 7 nuevas y `tierra_bosque.accentColor` ya no contiene `22C55E`; `detectCampinaColorPalette('algo sin pistas','')` → `pino_crema_terracota`.
   b. Cada estilo de `getCampinaTypographyStyles()` (menos `auto`) tiene `fontFamilies` no vacío.
   c. `buildCampinaImagePrompt({theme:'Descanso en noviembre',heroHeadline:'DESCONECTA',sublineHeadline:'x',typographyStyle:'rustic_timber',brandTreatment:'brush_stroke'})` contiene `Familias tipográficas de referencia: Bebas Neue` y `REGLA DE ARMONÍA`; y `git diff -- src/services/aiService.js` muestra que dentro de esa función solo se añadieron esas dos líneas.
   d. `chooseCampinaArtDirection` sin clave de Gemini (o con `generateJSON` simulado que devuelva ids inválidos) → devuelve ids válidos del catálogo y `reason` no vacío; con simulado válido respeta los ids y registra `campina_recent_palettes`. Limpiar luego esa clave de `settings` local.
   e. `stampContactLine` sobre una imagen de prueba creada con sharp (1080x1350, gradiente café a verde oscuro) y otra clara: guardar las salidas en el scratchpad `C:/Users/aaaa/AppData/Local/Temp/claude/C--Users-aaaa-orca-workspaces-proyecto-manejo-redes-sociales-eelpout/2e2037ea-409f-4df3-8910-dac1224fedfa/scratchpad/` (copiando antes la imagen de prueba a `uploads/` con nombre `__test_base.jpg` y borrándola al terminar, junto con los `contact-*.jpg` de prueba). Reportar rutas, dimensiones de salida (deben ser 1080x1350) y el color de texto elegido en cada caso.
   f. Express mínimo con auth simulado: `stamp-contact` con `imageUrl:'/uploads/../.env'` → 400; con marca sin contacto → 400 con el mensaje del contrato; `campina-art-options` → 200 con las 4 listas.

---
# PARTE B — Frontend
## Archivos permitidos
- `public/js/composer.js`, `public/index.html`

## Cambios exactos
1. **Bloque "Dirección de arte" en el panel `composer-post-image-panel`** (entre el bloque de titulares y el de escena), ids exactos, sin emojis en botones:
   - Selectores `pip-palette`, `pip-style`, `pip-treatment` (etiquetas: "Paleta", "Tipografía", "Acabado"), poblados desde `GET /api/ai/campina-art-options` (una vez, al primer uso; con opción inicial "Automático (IA)" `value=""` que significa "usar lo elegido por la IA").
   - Fila de muestras `pip-swatches` (círculos de 18 px con borde sutil) con los `swatches` de la paleta activa, y etiqueta `pip-palette-name`.
   - Texto `pip-art-reason` (cursiva, pequeño) con el `reason`, y línea `pip-font-families` ("Fuentes de referencia: ...").
   - Botón `btn-pip-regen-art` "Otra dirección de arte" → `POST /api/ai/campina-art-direction` con `{theme, targetDate, brief, imageUrl}` (imageUrl solo si `ComposerState.mediaFiles[0]` empieza por `/uploads/`).
2. **Lógica**: al recibir `artDirection` (de `campina-prepare-post` o `campina-art-direction`) pintar selectores (value = id elegido), muestras, nombre, motivo y familias, y guardar `window._pipArt`. Cuando el usuario cambia un selector, se vuelve a pintar muestras y se llama a `callPipComposePrompt()` (el existente) enviando `typographyStyle/brandTreatment/colorPalette/posterReference` tomados de los selectores `pip-*` (si el selector está en "" usar `window._pipArt`); mantener que `callPipComposePrompt` ya envía los selects `campina-*` actuales: reemplazar esa lectura por la de `pip-*` con fallback a `window._pipArt` y luego a `campina-*`.
3. **Bloque "Datos de contacto en la imagen"** (debajo del bloque de prompt final, ids exactos):
   - `pip-contact-enable` checkbox "Incluir datos de contacto, de forma sutil, abajo" (apagado por defecto) y, en una fila, tres checkboxes `pip-contact-whatsapp`, `pip-contact-web`, `pip-contact-direccion` ("WhatsApp", "Web", "Ubicación"), marcados por defecto; los que no estén disponibles según `contactAvailable` quedan deshabilitados con texto "(sin datos en Marca)". Si ninguno está disponible, deshabilitar todo el bloque con ese mensaje.
   - Botón `btn-pip-stamp-contact` "Estampar en la imagen" (habilitado solo con el checkbox activo) y `btn-pip-unstamp-contact` "Quitar datos de contacto" (oculto hasta estampar).
   - Texto de ayuda `pip-contact-help`: "Se estampa sobre la imagen final que subas (no sobre el prompt). Es reversible."
   - Lógica: al estampar, si `ComposerState.mediaFiles[0]` no empieza por `/uploads/` → toast "Sube primero la imagen final de Gemini" y no continuar. Guardar `window._pipOriginalImage = ComposerState.mediaFiles[0]` (solo la primera vez); `POST /api/media/stamp-contact {imageUrl, accountName, fields}` donde `accountName` sale del borrador (`post.account_name`, guardarlo en `window._pipAccountName` en `loadPostIntoComposer`) y `fields` de las casillas; en éxito reemplazar `ComposerState.mediaFiles[0]` por `data.url`, llamar a `renderMediaPreviews()` y `updateLivePreviews()`, mostrar las líneas estampadas en `pip-contact-help` y el botón de quitar. Quitar → restaurar `window._pipOriginalImage`, limpiar la variable, ocultar el botón. Si el usuario desmarca `pip-contact-enable` estando estampado → quitar automáticamente. Errores → toast con el mensaje del servidor.
   - `contactAvailable` llega en `post-brief` y `campina-prepare-post`; guardarlo en `window._pipContactAvailable` y aplicar el estado de las casillas (también al cargar el borrador, tras `post-brief`).
4. Limpieza: `window._pipArt`, `window._pipOriginalImage`, `window._pipAccountName`, `window._pipContactAvailable`, selectores y bloque de contacto se restablecen en `resetComposerFormState` y `resetAiModalState`, y al cargar otro borrador.
5. Subir caché: en `index.html`, `js/composer.js?v=2.8` → `?v=2.9`.
6. Todo texto de la IA con `innerHTML` pasa por `escapeHtml` (preferir `textContent`).

## Fuera de alcance (Parte B)
- No tocar `src/`, `storyMusic.js`, el modal Asistente IA ni Kmarket/Agendio. No commit ni push.

## Verificación (Parte B)
1. `node --check public/js/composer.js`.
2. Cruce con grep de todos los ids `pip-*`/`btn-pip-*` usados en JS contra `index.html` y viceversa (cuenta exacta por id; ojo: `btn-pip-*` incluye el prefijo).
3. Listar lo no probado en navegador.

## Criterio de terminado
Reporte con: estado, archivos tocados, salida literal de cada verificación, desviaciones y lo no verificado.
