# AGENTS.md — MetaPulse

Instrucciones compartidas para cualquier agente (Claude Code, Gemini CLI/agy, Codex).

## Qué es
MetaPulse es el centro de mando personal del dueño para gestionar redes (Facebook/Instagram) de sus clientes: Cabañas La Campiña, Kmarket Algarrobo y Agendio. No es multiusuario: no agregar OAuth, registro ni onboarding.

## Lecturas
- Arquitectura: `docs/architecture.md`
- Decisiones tomadas y por qué: `docs/decisions.md`
- Estado actual y próximo paso: `CURRENT_STATE.md`
- Tarea en curso (si existe): `TASK.md`

## Stack
Node.js + Express, better-sqlite3 (`data/metapulse.sqlite`, WAL), JS vanilla en `public/` (sin framework ni build), node-cron, Meta Graph API, Gemini API (capa gratis). Zona horaria forzada: `America/Santiago`.

## Convenciones
- UI y textos en español de Chile. Botones sin emojis.
- Respetar el salto de línea existente de cada archivo (la copia de trabajo usa CRLF).
- Columnas nuevas: `ALTER TABLE` dentro de `try/catch` en `src/database/db.js`. Tablas nuevas: `CREATE TABLE IF NOT EXISTS`.
- Rutas en `src/routes/api.js`, con el mismo patrón `try/catch` y `{ success, data|error }`. Errores de validación → 400, no encontrado → 404.
- Servicios = singletons en `src/services/` (`module.exports = new X()`). Si hay riesgo de dependencia circular con `aiService`, usar `require` perezoso dentro del método.
- Todo texto que venga de la IA y se inserte en el DOM pasa por `escapeHtml`.
- Llamadas a Gemini: usar `aiService.generateJSON` o la cadena `sanitizeGeminiModels()`; nunca fijar un modelo a mano.

## IA y costos
- Solo herramientas gratis. Antes de agregar algo que cueste dinero, avisar al dueño.
- Modelos de texto: `gemini-3.8-flash` → `3.7-flash` → `3.5-flash` → `3.1-flash-lite` (si uno da 503 pasa al siguiente). Los 1.x, 2.0 y 2.5 están retirados.
- Las imágenes editoriales las genera el dueño a mano en la app de Gemini; MetaPulse prepara el prompt. Pollinations no da la calidad necesaria.

## Seguridad
- Nunca imprimir ni commitear claves (`.env`, tabla `settings`: `ai_api_key`, tokens Meta).
- No levantar `server.js` completo para probar: arranca workers que envían alertas WhatsApp reales. Para probar rutas, montar el router en un Express mínimo con auth simulado.
- Todas las rutas `/api` exigen sesión (middleware en `api.js`).
- El scheduler solo publica `status='scheduled'`. Los `draft` nunca se publican solos.
- No tocar DMs: los clientes manejan sus mensajes; esos permisos no se piden.

## Verificación
- `node --check <archivo>` en cada JS tocado (obligatorio).
- Lógica de servicio: script de humo con `NODE_PATH` apuntando a `node_modules` del repo principal, contra la BD local, limpiando lo que se cree.
- `test_suite.js` requiere el servidor en `localhost:3000` (no usar en producción).
- La UI en navegador la prueba el dueño (requiere sesión).

## Flujo de trabajo
- Claude orquesta: escribe la especificación en `TASK.md` y audita.
- El ejecutor (agy / Gemini) implementa solo lo indicado en `TASK.md`, solo en los archivos permitidos, y reporta archivos tocados + salida de verificación + lo no verificado. El ejecutor no hace commit.
- Claude revisa el diff, corrige, hace commit, merge a `main`, push y despliegue.

## Despliegue (Contabo)
`root@37.60.235.111`, `/var/www/social-manager`, proceso PM2 `social-manager`, puerto 3000.
1. Respaldo de BD con better-sqlite3 `.backup()` en `/root/data_backup_<fecha>/`.
2. `git pull --ff-only origin main` (y `npm install` solo si cambió `package.json`).
3. `pm2 restart social-manager`; revisar `pm2 logs` y `curl localhost:3000`.
