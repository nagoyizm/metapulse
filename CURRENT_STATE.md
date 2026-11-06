# CURRENT_STATE — MetaPulse

Actualizado: 2026-11-05 · `main` desplegado en Contabo (commit `3f2a9eb`, PM2 online).

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

- **Historias:** `storySlotGuard` separa >=90 min las historias de una misma cuenta (goteo y lote); `node scripts/repair-story-slots.js [--apply]` reordena las ya agendadas.
- **Seguridad:** panel en `https://vmi3557669.taile1b8f4.ts.net` (Tailscale encendido); URL pública solo sirve `/uploads/*`. ufw 22/80/443, SSH solo llave, puerto 3000 local. Ver `docs/decisions.md` > Seguridad.

- **Regla 25 h:** la misma historia no se repite antes de 25 h por cuenta. **Facebook #200 en historias de Kmarket y La Campiña:** el usuario de Meta solo tiene tareas MODERATE/ANALYZE/CREATE_CONTENT en esas páginas; falta darle control total en Business Suite y regenerar el token (Instagram sí publica).
- **Copy IA:** `generateWithGemini` rechaza respuestas con `finishReason` MAX_TOKENS o con razonamiento filtrado (`looksLikeLeakedReasoning`); `maxOutputTokens` 4096. El borrador #301 (La Campiña) quedó con texto roto: regenerarlo.

- **Diseñador de historias (Creador → "Compartir como Historia" → 🎨):** texto gancho en cuadro blanco pegado a la imagen (Gemini lo sugiere; checkbox), ubicación, mención, cuenta regresiva (se recalcula por cada historia agendada) y stickers de emoji (Noto) que el dueño arrastra a su posición. Estático = imagen con borde blanco; animado = video de 7 s con GIF. Historias derivadas ya no llevan sticker de canción (si hay música, solo el audio). Solo imágenes; el diseño no se guarda en borradores ni aplica al lote.

## Novedades 2026-10-18 → 2026-11-05 (ya en producción)
- **Calendario:** arrastrar borradores a otro día para reordenarlos.
- **La Campiña:** check "Oferta/promoción" en el Creador (estética sobria + sello con texto exacto, conserva indicaciones de escena); la foto de referencia manda sobre el plan, resumen de lo que ve la IA y botón reanalizar; "Rehacer análisis"/"Preparar post" usan el texto actual del editor.
- **Contacto:** se elige dónde estamparlo arrastrándolo sobre la imagen.
- **Música:** búsqueda por tema con filtro de licencia comercial (ccMixter, Jamendo, Audius, Mi música), crédito automático al portapapeles; ccMixter vía proxy con Referer; al cambiar de canción se regenera desde la imagen original.
- **Historias:** GIF animados conservan la música; máximo configurable por ventana de 24 h con reubicación; diseñador funciona si el post pasó a video.
- **Creador/IA:** "Reescribir con instrucción libre" (con deshacer, reintenta si repite); editar posts programados en el Redactor; subida con barra de progreso (videos hasta 300 MB); lote conserva ediciones y avisa de tarjetas incompletas, logo no se estampa por defecto.
- **Actividad:** pestaña con feed de me gusta/comentarios de Instagram. **Archivos:** limpieza automática de generados sin uso (60 días). **Inicio:** publicaciones con falla parcial y motivo por red.
- **Seguridad:** sin contraseña en código, bloqueo por cuenta, cookie estricta, CORS cerrado, HTTPS por Tailscale.

- **Estudio de Reels (pestaña Reels, Kmarket y La Campiña):** subir clips/fotos y describirlos → la IA arma escenas, textos en pantalla, guion de voz y caption → voz Gemini TTS elegible (Sulafat, Achird, Vindemiatrix, Leda, Aoede, Puck, Algieba, Charon, Orus) + música con ducking → MP4 1080x1920 (FFmpeg, `reelStudioService.js`) → borrador de Reel. Probado con clips sintéticos y TTS real; falta probar con tus videos en el navegador. Sin logo todavía.

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
- Contabo: `package-lock.json` modificado y PNG sin seguimiento (no bloquean el pull). Sin fuentes del sistema: el texto sobre imagen usa `assets/fonts/Lato-*.ttf`.

## Respaldos / reversión
Etiquetas git: `prompt-maestro-v1`, `prompt-maestro-v2`, `creador-v1`. Texto del maestro v1 en `docs/backups/prompt-maestro-v1.txt`. Restaurar: `git checkout <etiqueta> -- <archivo>`.

## Próximo paso
Probar lo anterior y decidir C8/C11/C13/C14. Luego fase 2 de imagen: ficha visual por marca, imágenes aprobadas (bucle de calidad) y revisor previo a agendar. Ideas en cola: lote del mes ("preparar todos"), ficha de campaña con campos estructurados (oferta/condiciones/vigencia), analista semanal, reporte mensual para el cliente.
