# Decisiones — MetaPulse

Formato: fecha · decisión · por qué.

## Producto
- **2026-10-14 · Herramienta personal, no multiusuario.** El dueño la usa para sus clientes. Nada de OAuth, registro ni onboarding.
- **2026-10-14 · IA solo gratis.** Prioridad a la capa gratis; avisar antes de cualquier costo.
- **2026-10-15 · DMs fuera de alcance.** Las cuentas son de clientes y ellos manejan sus mensajes. No pedir `pages_messaging` ni `instagram_manage_messages`. El error de DMs en el log es esperado (pendiente: dejar de intentarlo).
- **2026-10-15 · La IA propone, el dueño aprueba.** Sin piloto automático: el planificador crea borradores (`draft`), que el scheduler nunca publica.
- **2026-10-15 · Indicaciones del cliente como fichas con vigencia.** El texto libre del cliente se convierte en fichas (`brand_campaigns`) que se inyectan solas en los prompts mientras están vigentes y se apagan al vencer. La IA no inventa condiciones; lo que falta va a preguntas abiertas.
- **2026-10-15 · Escasez solo si es real.** Las reglas prohíben urgencias falsas. "Últimas cabañas" solo se permite si la ficha tiene `permitirUrgencia` activado. La detección del conflicto es una regex fija, porque la IA no la detectaba sola.
- **2026-10-15 · Contacto por marca en el perfil.** Web/WhatsApp/etc. se configuran en Marca y se inyectan en todos los prompts; el cierre debe incluir web o WhatsApp.

## Imágenes
- **2026-10-15 · Las imágenes editoriales se hacen a mano en la app de Gemini.** Pollinations no da nivel editorial, y la generación de imágenes por API probablemente no es gratis. MetaPulse prepara el brief: concepto, prompt sin texto, foto real a adjuntar, titular y variantes.
- **2026-10-15 · La imagen se genera sin texto.** Las IAs de imagen se equivocan con letras y cifras; el titular va aparte (pendiente: plantilla para superponerlo en MetaPulse, fase 2).
- **Partir de fotos reales de la marca** cuando sea posible: más editorial y no muestra instalaciones que no existen.

## Técnica
- **2026-10-15 · Migración a Gemini 3.x.** `gemini-2.5-flash`, `2.0` y `1.5` dejaron de responder ("no longer available"). Cadena: 3.8-flash → 3.7-flash → 3.5-flash → 3.1-flash-lite; se salta al siguiente ante 503. Los modelos retirados se filtran aunque estén guardados en ajustes.
- **2026-10-15 · Groq/OpenRouter solo como posible respaldo futuro.** Ninguno supera a Gemini 3.x Flash en español con prompts largos; OpenRouter gratis tiene solo 50 req/día.
- **2026-10-15 · Editar en el Creador = crear nuevo + borrar el borrador.** Reutiliza todo el flujo de guardado (historia, música, marca de agua) sin duplicarlo. `DELETE /posts/:id` no borra archivos de media. Un post `scheduled` editado se cancela en vez de borrarse.
- **2026-10-15 · Métricas propias.** `metricsSyncService` guarda métricas diarias para que la IA imite los posts que mejor funcionaron.
- **2026-10-14 · Detección de páginas con token de usuario de larga duración.**

## Imagen y prompts
- **2026-10-16 · Indicaciones de escena aparte del Prompt Maestro.** El maestro conserva las directrices de marca (foto intacta); un recuadro propio suma lo específico del post (personas, ambiente) deducido por IA con 5 pasos desde foto + enfoque + campaña. Tiene prioridad solo en lo que declara.
- **2026-10-16 · Borradores del plan guardan `plan_context`** (enfoque, gancho, ocasión, campaña) para prellenar "Tema" y "Ocasión" en el Creador.
- **2026-10-16 · Titulares generativos con memoria.** 5 opciones por IA (temp 1.0, sin caché) y lista de los últimos 30 heroes usados como prohibidos; el catálogo fijo queda solo como último respaldo.
- **2026-10-16 · Texto del Prompt Maestro congelado** hasta que el dueño apruebe las mejoras de `docs/auditoria-prompt-maestro.md`.

- **2026-10-16 · Flujo borrador→post:** panel en el Creador, botón "Preparar post", Gemini dibuja el titular, foto subida cada vez. Detalle en `docs/informe-flujo-borrador-a-post.md`.

- **2026-10-16 · Prompt maestro v2:** aplicadas mejoras A-G de la auditoría (escena en vez de madera, precedencia del bloque del post, zonas seguras 1:1, control de calidad, posición libre del titular, oro solo si la paleta lo permite, selección visual unificada). Respaldo: etiqueta `prompt-maestro-v1`.

- **2026-10-16 · Dirección de arte elegida por IA desde paletas curadas** (60/30/10, sin verdes saturados sobre cafés); muestras y selectores editables en el panel. Respaldos: etiquetas `prompt-maestro-v1` y `prompt-maestro-v2`.
- **2026-10-16 · Datos de contacto los estampa MetaPulse** (Lato, `assets/fonts`, sharp con `fontfile`; el servidor Linux no tiene fuentes del sistema). Casilla opcional, reversible, omite lo vacío en Marca.

- **2026-10-16 · Creador por pasos:** 1 Destino y formato, 2 Texto, 3 Imagen del post, 4 Música, 5 Programación y agenda, con insignias de estado y resumen antes de agendar. El Asistente IA pasa al menú "Más herramientas IA"; un solo "Reiniciar"; el panel es el único origen de tema/ocasión y de la foto de referencia. Respaldo: etiqueta `creador-v1`. Pendiente de decidir: C8, C11, C13, C14.

## Forma de trabajo
- **2026-10-14 · Claude orquesta, agy ejecuta.** Ahorra tokens de Claude; agy usa Gemini.
- **2026-10-15 · Menos pruebas duplicadas.** El subagente no repite pruebas que Claude hará; la UI la prueba el dueño.
- **2026-10-16 · Respuestas breves y concisas** en este proyecto.
- Cada cambio va a `main` y se despliega en Contabo, con respaldo previo de la BD.
