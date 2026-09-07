# Antigravity Agent Guidelines — MetaPulse

## 1. Zero-Interruption & Maximum Autonomy Policy
- **Proactive End-to-End Execution:** Cuando el usuario solicite un cambio, corrección, diseño o nueva funcionalidad, investiga, implementa, prueba y aplica los cambios directamente de extremo a extremo sin pedir permisos intermedios.
- **Never Request Interactive Feedback on Artifacts:** Nunca uses `RequestFeedback: true` en los metadatos de los artefactos (`implementation_plan.md` o similares) ya que bloquea la ejecución esperando aprobación manual.
- **No Planning Approval Gate:** No te detengas a pedir aprobación de planes técnicos en tareas habituales, correcciones de bugs o peticiones de producto. Procede directamente con la ejecución.
- **Do Not Use `ask_question` Tool:** Salvo que falte una credencial privada irrecuperable sin la cual sea físicamente imposible avanzar, nunca uses el modal interactivo de preguntas.
- **Automatic Git Operations:** Modifica los archivos, valida con linters/pruebas, y ejecuta `git add`, `git commit` y `git push origin main` de forma autónoma.
- **Concise Final Summary:** Al finalizar, reporta directamente el resultado final y el comando para desplegar en producción si corresponde.
