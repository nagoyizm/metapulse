# Arquitectura — MetaPulse

## Visión general
```
Navegador (public/, JS vanilla)
   │  fetch /api/*  (sesión obligatoria)
   ▼
server.js  ── Express ── src/routes/api.js
   │                        │
   │                        ├─ servicios (src/services/*)
   │                        │     ├─ Meta Graph API (FB/IG)
   │                        │     ├─ Gemini API (texto + imagen)
   │                        │     └─ WhatsApp (alertas)
   │                        └─ SQLite (data/metapulse.sqlite)
   └─ workers cron: scheduler, inboxSync, metricsSync
```
Monolito Node sin build. Estáticos desde `public/`, media en `uploads/`. TZ forzada a `America/Santiago` en `server.js`.

## Frontend (`public/`)
SPA en un solo `index.html` con pestañas: Hoy, Crear, Calendario, Bandeja, Resultados, Marca.

| Archivo | Responsabilidad |
|---|---|
| `js/app.js` | navegación, estado global (`AppState`), cuenta activa |
| `js/auth.js` | sesión |
| `js/composer.js` | Creador por pasos: copy IA, flujos por marca (Kmarket/Campiña/Agendio), media, historia, música, `loadPostIntoComposer`, tarjeta "Imagen sugerida" (otras marcas) y **panel "Imagen del post"** (`pip-*`, solo Campiña). Insignias y chips: `updateComposerProgress` |
| `js/calendar.js` | calendario/lista/horarios; borradores abren en el Creador |
| `js/batchScheduler.js` | programación masiva |
| `js/brand.js` | perfiles de marca (voz, reglas, hashtags, contacto); emite `brand:selected` |
| `js/campaigns.js` | fichas de campaña, interpretar mensaje del cliente, planificador del mes |
| `js/analytics.js` | resultados |
| `js/inbox.js` | bandeja (comentarios) |
| `js/watermark.js`, `js/storyMusic.js`, `js/settings.js` | marca de agua, música de historias, ajustes |
| `css/composer-steps.css` | pasos del Creador, menú IA, progreso y resumen antes de agendar |

## Backend
`src/routes/api.js` (~3.600 líneas): todas las rutas bajo `/api`, con middleware de sesión al inicio.

Servicios principales (`src/services/`):
- `aiService` — toda la IA. Cadena de modelos `sanitizeGeminiModels()`, `generateJSON`, `generateCopy`, flujos por marca, `cleanCaptionAI`, `suggestImagePrompt`, `generateDirectImage`. Circuit breaker ante fallos de Gemini.
- `campaignService` — fichas de campaña (`brand_campaigns`): CRUD, `getActive`, `buildCampaignBlock`, `parseBrief`, `planMonth`, `createDraftsFromPlan`.
- `brandProfileService` — perfiles (`brand_profiles`), `buildContactBlock`.
- `contentMemoryService` — captions recientes (evita repetir), mejores ejemplos por métricas, rotación de hashtags.
- `editorialPlannerService` — directrices editoriales por marca.
- `metaService` — Graph API: publicar, cuentas, métricas, inbox.
- `schedulerService` — cron cada minuto; publica `status='scheduled'` vencidos; maneja fallos parciales (`partial_failure`).
- `metricsSyncService` — cron diario 04:17; guarda métricas en `post_metrics`.
- `inboxSyncService` — cada 90 s; comentarios + alertas WhatsApp (los DMs fallan por permisos; esperado).
- `imageService` (`stampContactLine`: contacto sobre la imagen final con Lato), `videoService`, `musicService` — sharp/ffmpeg: marca de agua, formatos, afiches, video con audio.
- `chileCalendar` — feriados y fechas de ocasión de Chile (ocasión real del brief).
- `aiService` (Campiña): `buildPostBrief`, `generateCampinaHeadlines`, `buildCampinaSceneDirective`, `chooseCampinaArtDirection`, `resolveCampinaVisualSelection`, `buildCampinaImagePrompt` (Prompt Maestro v2), `buildCampinaPostBlock`/`FullPrompt`, `loadUploadImageInline` (reduce a 1280 px).
- `aiCacheService`, `aiJobQueueService`, `slotService`, `authService`, `whatsappService`.

Datos fijos: `src/data/brandSeeds.js` (perfiles iniciales), `src/data/campinaKnowledge.js` (fuente de verdad de La Campiña), `src/config/copyRules.js`.

## Base de datos (SQLite, WAL)
| Tabla | Uso |
|---|---|
| `settings` | clave/valor: claves IA, tokens Meta, `cached_managed_accounts`, `ai_model` |
| `posts` | publicaciones. `status`: draft, scheduled, processing, published, failed, cancelled. Extra: `account_id`, `account_name`, `meta_post_id`, `partial_failure` |
| `schedule_slots`, `schedule_presets` | horarios habituales |
| `media_items`, `watermarks` | archivos |
| `brand_profiles` | perfil JSON por marca (voz, reglas, hashtags, `contact`) + `match_keywords` |
| `brand_campaigns` | fichas: tipo, vigencia, `directive`, `details`, preguntas abiertas, estado |
| `post_metrics` | métricas por media de IG (likes, comentarios, score) |
| `inbox_*` | conversaciones, mensajes, comentarios |
| `ai_cache`, `ai_jobs`, `analytics_cache` | cachés y cola |

Migraciones: en `initializeDatabase()` (`src/database/db.js`), idempotentes.

## Flujos clave
**Copy con IA:** prompt de marca = reglas + voz + **fichas vigentes** + **contacto** + mejores ejemplos + memoria reciente → Gemini (cadena de modelos) → `cleanCaptionAI` (quita markdown y líneas basura).

**Mensaje de cliente → plan:** Marca → pegar texto → `parseBrief` (fichas + preguntas + conflictos; detección fija de escasez) → guardar → `planMonth` → `createDraftsFromPlan` (borradores sin imagen).

**Borrador → publicación:** Calendario → Editar → Creador (`loadPostIntoComposer`) → tarjeta de prompt de imagen → el dueño genera en Gemini → sube imagen → guardar (`POST /posts` + `DELETE` del borrador).

**Publicación:** scheduler → `metaService` → FB/IG; fallos parciales quedan marcados.

## Integraciones
- **Meta Graph API:** token de usuario de larga duración → páginas e IG. Sin permisos de DM (decisión).
- **Gemini API:** capa gratis, clave en `settings.ai_api_key` o `GEMINI_API_KEY`.
- **WhatsApp:** alertas de comentarios sin responder.

## Despliegue
VPS Contabo `37.60.235.111`, `/var/www/social-manager`, PM2 `social-manager`, puerto 3000. Procedimiento en `AGENTS.md`. Desarrollo en git worktrees; `main` es la rama desplegada.

**Imagen del post (Campiña):** borrador con `plan_context` → `POST /ai/post-brief` (brief, cacheado en `plan_context.brief`) → `POST /ai/campina-prepare-post` (titulares + escena + dirección de arte en paralelo; devuelve `fullPrompt`, `artDirection`, `contactAvailable`, `warnings`) → `POST /ai/campina-compose-prompt` (determinista, recalcula al editar) → `POST /media/stamp-contact` (imagen final en `/uploads`, reversible) . Opciones de arte: `GET /ai/campina-art-options`. Memorias en `settings`: `campina_recent_heroes` (30), `campina_recent_palettes` (5).
