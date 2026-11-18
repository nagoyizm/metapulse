# CURRENT_STATE — MetaPulse

Actualizado: 2026-11-18 · `main` desplegado en Contabo (commit `b44b142`, PM2 online).

## Funciona (en producción)
- Publicación programada FB/IG con detección de fallos parciales; IA de texto con Gemini 3.x (cadena gratis, salto ante 503); métricas diarias; limpieza de captions.
- Pestaña Marca: perfil, hashtags, **datos de contacto**, **campañas e indicaciones** (fichas con vigencia). **Planificador del mes** → borradores con `plan_context` (enfoque, gancho, ocasión, campaña).
- **Creador por pasos:** 1 Destino y formato · 2 Texto · 3 Imagen del post · 4 Música · 5 Programación y agenda, con insignias de estado y chips de resumen antes de agendar. Asistente IA en el menú "Más herramientas IA". Un solo "Reiniciar".
- **Panel "Imagen del post" (borradores de La Campiña):**
  - "Preparar post" arma, con IA: brief (tema trabajado, ocasión real con calendario de Chile, público, foto a subir, música), 5 titulares sin repetir (memoria de 30), escena con personas chilenas no estereotipadas, **dirección de arte** (paleta/tipografía/acabado elegidos mirando la foto, muestras y selectores editables) y **un solo prompt** = Prompt Maestro v2 + bloque del post.
  - Entradas separadas: **foto de referencia** (solo IA) e **imagen final de Gemini** (la que se publica); "Estampar Logo" junto a la imagen final.
  - **Contacto estampado por MetaPulse** (casilla opcional, reversible; WhatsApp/web/ubicación desde Marca, vacío se omite).
  - Música: mood y palabras clave que abren el buscador existente.
- Otras marcas (Kmarket, Agendio) conservan su flujo anterior y la tarjeta "Imagen sugerida".

- **Estudio de Reels 2.0 (Pestaña Reels, Kmarket y La Campiña):**
  - **Arquitectura desacoplada en 5 pasos:**
    1. *Guion y Fórmula:* Plantillas narrativas (reseña, top 3, atmósfera, promo) o guion personalizado libre + duración objetivo (6 a 25 s).
    2. *Clips Grabados:* Subida múltiple (MP4/MOV/fotos) con barra de progreso XHR en tiempo real (MB/%/velocidad), arrastre drag & drop y descripciones por clip.
    3. *Cortes de Video y Encuadre 9:16:* Secuencia de tomas, inicio en clip original, duración de corte, transiciones dinámicas xfade (*Zoom Dinámico/Punch*, *Slide rápido*, *Flash blanco*, *Paneo suave*, *Disolución*, *Corte directo*). Encuadre horizontal a vertical 9:16 interactivo en la **mini pantalla** mediante botones (Izquierda/Centro/Derecha), zoom slider y arrastre directo con el ratón (pan X/Y libre) sobre el canvas, con soporte de modo `crop` o `blur`.
    4. *Capa de Textos y Efectos Virales:* Overlays de texto flotantes con tiempos independientes (`start` y `end` en segundos globales). Un texto puede abarcar varias tomas y permanecer visible durante transiciones de video. 14 tipografías virales instaladas en el servidor, 5 estilos de cápsula (amarilla viral TikTok, cápsula oscura, borde de impacto Hormozi, resplandor neón, sombra limpia) y 5 efectos de animación (`pop` punch, `fade`, `slide`, `bounce`, `none`). Previsualización instantánea en la mini pantalla y botón "Sugerir textos con IA" (`/api/reel/suggest-texts`) sin alterar los cortes de video.
    5. *Música, Voz y Render:* Locución con Gemini TTS gratuito (Sulafat, Achird, etc.), búsqueda de música libre con ducking automático al hablar la voz, renderizado MP4 1080x1920 con FFmpeg encadenando filtros xfade + drawtext sobre master stream, y guardado directo a borrador de post.
  - **Persistencia local de borrador (`localStorage`):** Guardado automático en `metapulse_reel_studio_draft` para soportar F5 / recargas sin perder clips subidos, encuadres, tomas ni textos.

- **Historias:** `storySlotGuard` separa >=90 min las historias de una misma cuenta (goteo y lote); `node scripts/repair-story-slots.js [--apply]` reordena las ya agendadas.
- **Seguridad:** panel en `https://vmi3557669.taile1b8f4.ts.net` (Tailscale encendido); URL pública solo sirve `/uploads/*`. ufw 22/80/443, SSH solo llave, puerto 3000 local. Ver `docs/decisions.md` > Seguridad.

- **Regla 25 h:** la misma historia no se repite antes de 25 h por cuenta. **Facebook #200 en historias de Kmarket y La Campiña:** el usuario de Meta solo tiene tareas MODERATE/ANALYZE/CREATE_CONTENT en esas páginas; falta darle control total en Business Suite y regenerar el token (Instagram sí publica).
- **Copy IA:** `generateWithGemini` rechaza respuestas con `finishReason` MAX_TOKENS o con razonamiento filtrado (`looksLikeLeakedReasoning`); `maxOutputTokens` 4096. El borrador #301 (La Campiña) quedó con texto roto: regenerarlo.

- **Diseñador de historias (Creador → "Compartir como Historia" → 🎨):** texto gancho en cuadro blanco pegado a la imagen (Gemini lo sugiere; checkbox), ubicación, mención, cuenta regresiva (se recalcula por cada historia agendada) y stickers de emoji (Noto) que el dueño arrastra a su posición. Estático = imagen con borde blanco; animado = video de 7 s con GIF. Historias derivadas ya no llevan sticker de canción (si hay música, solo el audio). Solo imágenes; el diseño no se guarda en borradores ni aplica al lote.

## Novedades 2026-11-05 → 2026-11-18 (ya en producción)
- **Estudio de Reels 2.0 completo:** Separación total de pista de video (Paso 3) y capa de textos (Paso 4).
- **14 Tipografías virales para Reels y TikTok:** Archivo Black, Bangers, Titan One, Righteous, Syne, Bebas Neue, Anton, Montserrat, Poppins, Oswald, Playfair Display, Cinzel, Caveat, Lato (TTF locales en `assets/fonts/` + Google Fonts).
- **Animaciones de texto en Reels:** Pop-in / Punch, Fade suave, Slide up desde abajo y Bounce elástico tanto en CSS en la mini pantalla como en expresiones matemáticas de tiempo en FFmpeg (`alpha` e `y`).
- **Mini pantalla 9:16 interactiva:** Visualización vertical fiel a Reels, encuadre pan/zoom arrastrable con el ratón, botón "Previsualizar" por texto y reproducción sincronizada.
- **Resistencia a F5:** Sesión y borrador de reels persisten en `localStorage`; no se resetea al recargar.

## Pendiente de prueba por el dueño
00. Lo de la sección anterior (oferta, arrastre en calendario, contacto arrastrable, búsqueda de música por tema, actividad) no tiene registro de prueba del dueño.
0. Diseñador de historias en el navegador (arrastrar, tamaño/giro, sugerir con IA, estático y animado) y revisar la historia agendada. (UI, con Gemini real)
1. Borrador de La Campiña → Editar → panel, "Preparar post" y barra de progreso; paleta elegida y "Otra dirección de arte".
2. Subir referencia + imagen final; estampar contacto y logo; quitar contacto.
3. Menú "Más herramientas IA", chips de resumen, tema/ocasión sincronizados con el modal.
4. Prompt v2 en Gemini: titular no cortado en recorte 1:1, sin madera inventada, sin manos/rostros raros, personas no estereotipadas.
5. Completar **dirección** en Marca (La Campiña) para habilitar "Ubicación"; corregir WhatsApp de Agendio (igual al de La Campiña).
6. Nada de lo nuevo se probó con Gemini real ni en navegador: solo humo con modelo simulado.

## Decisiones abiertas
- Creador: C8 (esconder botones de diseñar imagen), C11 (panel en pestañas/acordeón), C13 (copiar/abrir Gemini fijos), C14 (pre-escucha de música).
- Botón "Maquetar flyer de La Campiña" quedó dentro de "Subir archivos a mano" (plegado en Campiña).
- Música: Openverse no sirve (solo efectos con licencia pública); la opción real es Jamendo (`jamendo_client_id` gratis, ya soportado).

## Problemas conocidos
- `parseBrief` pone el inicio de la ficha de Año Nuevo en "hoy" en vez de ~6 semanas antes (se corrige a mano).
- Borradores sin `account_id` no se ven si el calendario filtra por cuenta; borradores anteriores a `plan_context` calculan el brief al abrirlos.
- `inboxSyncService` intenta leer DMs cada 90 s y llena el log de permisos (falta desactivarlo).
- Contabo: reels usan ffmpeg del sistema (`apt install ffmpeg`, 6.1 con drawtext); el de ffmpeg-static no trae drawtext. `package-lock.json` modificado y PNG sin seguimiento (no bloquean el pull). Sin fuentes del sistema: el texto sobre imagen usa `assets/fonts/Lato-*.ttf`.

## Respaldos / reversión
Etiquetas git: `prompt-maestro-v1`, `prompt-maestro-v2`, `creador-v1`. Texto del maestro v1 en `docs/backups/prompt-maestro-v1.txt`. Restaurar: `git checkout <etiqueta> -- <archivo>`.

## Próximo paso
Probar lo anterior y decidir C8/C11/C13/C14. Luego fase 2 de imagen: ficha visual por marca, imágenes aprobadas (bucle de calidad) y revisor previo a agendar. Ideas en cola: lote del mes ("preparar todos"), ficha de campaña con campos estructurados (oferta/condiciones/vigencia), analista semanal, reporte mensual para el cliente.
