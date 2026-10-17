# CURRENT_STATE — MetaPulse

Actualizado: 2026-10-17 · `main` desplegado en Contabo (commit `c82e00b`).

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

## Pendiente de prueba por el dueño (UI, con Gemini real)
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
