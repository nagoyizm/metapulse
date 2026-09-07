# Reglas de Autonomía y Flujo de Trabajo (Antigravity / MetaPulse)

## 1. Máxima Autonomía y Cero Interrupciones
* **Proactividad Total de Principio a Fin:** Cuando el usuario solicite un cambio, corrección, diseño o nueva funcionalidad, investiga, implementa, prueba y aplica los cambios directamente de extremo a extremo sin pedir permisos intermedios ni detenerte.
* **Prohibido solicitar aprobación de planes técnicos:** No crees planes con `RequestFeedback: true` ni pauses la conversación esperando que el usuario presione botones de aprobación para continuar.
* **Prohibido el uso de `ask_question`:** Salvo que una credencial crítica falte por completo y sea imposible avanzar, no uses la herramienta de preguntas interactivas ni generes modales de confirmación.
* **No pedir confirmación para tareas evidentes:** No hagas preguntas como "¿Deseas que proceda?", "¿Quieres que instale esto?", "¿Hago el push?". Si la intención del usuario es clara, procede de inmediato.
* **Flujo Git Automático:** Guarda los archivos, haz `git add`, `git commit` y `git push origin main` automáticamente tras completar las tareas para que el usuario siempre tenga su código sincronizado.
* **Respuestas Concisas Orientadas al Producto Final:** Al terminar, muestra directamente el resultado final y el comando para desplegar en producción.
