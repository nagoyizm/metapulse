# Reglas de Autonomía y Flujo de Trabajo (Antigravity / MetaPulse)

## 1. Máxima Autonomía y Cero Interrupciones
* **Proactividad Total:** Cuando el usuario solicite un cambio, corrección, diseño o nueva funcionalidad, investiga, implementa, prueba y aplica los cambios directamente de extremo a extremo sin pedir permisos intermedios.
* **No pedir confirmación para tareas evidentes:** No hagas preguntas como "¿Deseas que proceda?", "¿Quieres que instale esto?", "¿Hago el push?". Si la intención del usuario es clara, procede de inmediato.
* **Flujo Git Automático:** Guarda los archivos, haz `git add`, `git commit` y `git push origin main` automáticamente tras completar las tareas para que el usuario siempre tenga su código sincronizado.
* **Solo preguntar en casos extremos:** Únicamente detente a consultar si existe riesgo irreversible de pérdida de datos críticos o si una decisión de producto es fundamentalmente ambigua e incompatible.
* **Respuestas Concisas:** Al terminar, resume brevemente qué se modificó y proporciona el comando exacto para desplegar en el servidor de producción.
