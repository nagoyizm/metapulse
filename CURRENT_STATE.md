# CURRENT_STATE — MetaPulse

Actualizado: 2026-10-16 · `main` desplegado en Contabo (commit `2a9f15a` + docs).

## Funciona (en producción)
- Publicación programada FB/IG con detección de fallos parciales.
- IA de texto con Gemini 3.x (cadena gratis con salto ante 503).
- Métricas diarias (`post_metrics`, 04:17) y mejores ejemplos inyectados en prompts.
- Pestaña Marca: perfil, hashtags, **datos de contacto**, **campañas e indicaciones** (interpretar mensaje del cliente → fichas con vigencia, preguntas y conflictos).
- **Planificador del mes** → borradores en el calendario.
- Borradores se editan en el **Creador** completo; al guardar se reemplazan (sin duplicados).
- Tarjeta **"Imagen sugerida para Gemini"** (prompt sin texto, foto a adjuntar, titular, variantes).
- Limpieza de captions (sin markdown ni líneas basura).

## Pendiente de prueba por el dueño (UI)
1. Datos de contacto en Marca; corregir WhatsApp de Agendio (quedó igual al de La Campiña).
2. Borrador → Editar → abre en el Creador con la cuenta correcta.
3. Tarjeta de prompt de imagen: autollenado, copiar, abrir Gemini, variantes.
4. Guardar borrador → queda una sola publicación.
5. Copy nuevo de La Campiña cierra con web/WhatsApp y sin asteriscos.

## Problemas conocidos
- `parseBrief` pone el inicio de la ficha de Año Nuevo en "hoy" en vez de ~6 semanas antes (se corrige a mano).
- Borradores sin `account_id` no se ven si el calendario filtra por cuenta.
- `inboxSyncService` intenta leer DMs cada 90 s y llena el log de errores de permisos (decisión: no usar DMs; falta desactivarlo).
- El servidor de Contabo tiene `package-lock.json` modificado localmente y PNG sin seguimiento (no bloquean el pull).

## Próximo paso: fase 2 — imagen
1. Ficha visual por marca (paleta, luz, encuadres, qué evitar, fotos de referencia aprobadas).
2. Plantilla para superponer titular/promo/logo sobre la imagen de Gemini (base: `imageService`).
3. Marcar imágenes aprobadas para afinar los prompts.

## Ideas en cola
Revisor antes de publicar · ideas proactivas por feriados/huecos · analista semanal · reporte mensual para el cliente.
