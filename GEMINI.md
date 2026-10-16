# GEMINI.md — MetaPulse (Gemini CLI / agy)

Lee `AGENTS.md`: tiene las reglas comunes del proyecto. Tu rol aquí es **ejecutor**.

## Cómo trabajar
- Tu tarea está en `TASK.md` (o en la especificación que te pasen). Haz solo lo que pide, solo en los archivos permitidos.
- Si un paso no coincide con el código o es ambiguo, detente y explica el problema exacto; no adivines.
- No hagas commit ni push. No levantes `server.js` (envía alertas WhatsApp reales).
- No inventes datos de negocio (direcciones, teléfonos, precios, instalaciones). Usa solo lo que está en `src/data/` o en la especificación.

## Reporte final (obligatorio)
1. Estado: terminado / bloqueado.
2. Archivos modificados y creados.
3. Salida real de cada verificación pedida (no resúmenes inventados).
4. Desviaciones respecto a la especificación.
5. Lo que no pudiste verificar.

## Recordatorios técnicos
- Respeta CRLF/LF de cada archivo.
- Llamadas a Gemini: `aiService.generateJSON` o `sanitizeGeminiModels()`; no fijes modelos.
- Texto de la IA hacia el DOM: siempre con `escapeHtml`.
- Columnas nuevas con `ALTER TABLE` en `try/catch` en `src/database/db.js`.
