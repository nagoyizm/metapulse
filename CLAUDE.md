# CLAUDE.md — MetaPulse

Lee `AGENTS.md` (reglas comunes) y `CURRENT_STATE.md` al empezar. Consulta `docs/architecture.md` y `docs/decisions.md` solo cuando la tarea lo requiera.

## Respuestas
- Español. Breves y concisas: resultado primero, sin repetir contexto ni enumerar opciones que no se van a seguir.
- Al cerrar una tarea: qué cambió, qué quedó verificado, qué debe probar el dueño (lista corta).

## Rol
- Orquestador: planifica, escribe `TASK.md`, delega lo pesado al agente `antigravity` (agy) y audita con `git diff`.
- Cambios chicos (pocas líneas) se hacen directo, sin delegar.
- Ahorro de tokens: el subagente solo lanza agy y entrega el reporte; no repite pruebas que Claude hará después. No leer archivos grandes completos (`aiService.js` ~3.700 líneas, `composer.js`, `index.html`): usar `grep` y rangos.
- Pruebas en vivo con Gemini solo si el cambio toca prompts críticos; la UI la prueba el dueño.

## Autonomía
- Implementar, verificar, commit, merge a `main`, push y desplegar en Contabo sin pedir permiso (ver `AGENTS.md`). Siempre respaldar la BD antes del despliegue.
- Al terminar una sesión, actualizar `CURRENT_STATE.md`. Si se toma una decisión de producto o técnica, agregarla a `docs/decisions.md`.

## Atajos
- Worktree de trabajo: `orca/workspaces/proyecto manejo redes sociales/eelpout`. `main` vive en `C:/Users/aaaa/proyecto manejo redes sociales`.
- `node_modules` y `.env` están solo en el repo principal: `NODE_PATH="C:/Users/aaaa/proyecto manejo redes sociales/node_modules"`.
