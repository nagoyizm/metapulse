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
- **2026-10-15 · (Reemplazada el 2026-10-16)** La imagen se generaba sin texto; ahora Gemini dibuja el titular y MetaPulse solo estampa contacto/logo.
- **Partir de fotos reales de la marca** cuando sea posible: más editorial y no muestra instalaciones que no existen.

## Técnica
- **2026-10-15 · Migración a Gemini 3.x.** `gemini-2.5-flash`, `2.0` y `1.5` dejaron de responder ("no longer available"). Cadena: 3.8-flash → 3.7-flash → 3.5-flash → 3.1-flash-lite; se salta al siguiente ante 503. Los modelos retirados se filtran aunque estén guardados en ajustes.
- **2026-10-15 · Groq/OpenRouter solo como posible respaldo futuro.** Ninguno supera a Gemini 3.x Flash en español con prompts largos; OpenRouter gratis tiene solo 50 req/día.
- **2026-10-15 · Editar en el Creador = crear nuevo + borrar el borrador.** Reutiliza todo el flujo de guardado (historia, música, marca de agua) sin duplicarlo. `DELETE /posts/:id` no borra archivos de media. Un post `scheduled` editado se cancela en vez de borrarse.
- **2026-10-15 · Métricas propias.** `metricsSyncService` guarda métricas diarias para que la IA imite los posts que mejor funcionaron.
- **2026-10-14 · Detección de páginas con token de usuario de larga duración.**

## Imagen y prompts (La Campiña)
- **2026-10-16 · Flujo:** borrador del plan → panel "Imagen del post" en el Creador → "Preparar post" (un botón) → prompt para Gemini web → imagen final subida → contacto/logo → música → fecha → el dueño revisa y agenda. La IA propone, el dueño decide.
- **Un brief por post** (tema trabajado, ocasión desde calendario de Chile, público, foto a subir, música) guardado en `posts.plan_context`; copy, titulares, escena y prompt lo consumen. Promociones solo si la ficha de campaña tiene `oferta`; nunca inventar cifras.
- **Gemini dibuja el titular** (el texto exacto va entre comillas, con guardas de ortografía). Titulares: 5 opciones por IA, sin caché, con memoria de los últimos 30 usados.
- **Personas en la escena (La Campiña):** rasgos comunes en Chile, sin estereotipos, nunca en primer plano, habitando el espacio. Kmarket y Agendio actúan distinto (otros rubros).
- **Prompt Maestro v2** (mejoras A-G): escena en vez de "madera", precedencia del bloque del post, zonas seguras 1:1, control de calidad, posición libre del titular, oro solo si la paleta lo permite, selección visual unificada (`resolveCampinaVisualSelection`). Respaldo: etiqueta `prompt-maestro-v1`.
- **Dirección de arte elegida por IA** mirando la foto, desde paletas curadas (regla 60/30/10, sin verdes saturados sobre cafés) y tipografías con familias reales; se evitan las últimas 5 paletas; editable en el panel. La foto se reduce a 1280 px antes de enviarla a Gemini.
- **Contacto estampado por MetaPulse, no por Gemini:** Lato (`assets/fonts`) con sharp y `fontfile` (Contabo no tiene fuentes), casilla opcional, reversible, omite lo vacío en Marca.
- **Foto de referencia (IA) separada de la imagen final (publicación).**
- **Creador por pasos:** 1 Destino · 2 Texto · 3 Imagen · 4 Música · 5 Agenda; Asistente IA en menú "Más herramientas IA"; el panel es el único origen de tema/ocasión y de la foto de referencia. Respaldo: etiqueta `creador-v1`.

## Historias
- **2026-10-18 · Stickers "no oficiales" dibujados dentro de la imagen/video.** La API de Instagram no admite stickers nativos (música, encuesta, enlace, mención); terceros como Storrito usan la sesión del usuario (riesgo para la cuenta). Se dibujan en el medio: visuales y no interactivos. Emojis: Noto Emoji de Google (PNG Apache 2.0; GIF animados CC BY 4.0, atribución aquí). Texto del cuadro: Montserrat Medium (OFL), lo más cercano a la fuente de Instagram.
- **2026-10-18 · Historias derivadas sin sticker de canción**; el cuadro blanco con texto gancho (opcional) lo reemplaza. Posiciones guardadas como fracciones del lienzo 1080x1920 para que servidor y vista previa coincidan.
- **2026-10-18 · Horarios de historias** separados >=90 min por cuenta (`storySlotGuard`).
- **2026-10-19 · La misma historia no se repite antes de 25 h** (dura 24 h; si no, se ven dos a la vez). Las distintas siguen separadas >=90 min.
- **2026-10-19 · Copy de Gemini: se descarta si llega cortado (MAX_TOKENS) o con razonamiento interno filtrado** ("-> 92 characters. Passes."); cae al texto local del planificador. Causa del borrador #301 de La Campiña roto.

## Seguridad
- **2026-10-21 · Contraseñas fuera del código.** Había una contraseña fija en `authService` (y en el historial de git) que se reponía en cada arranque. Ahora el usuario inicial sale de `ADMIN_EMAIL`/`ADMIN_PASSWORD` y la clave se cambia con `scripts/set-password.js` (cierra sesiones). Hay que rotar la clave antigua.
- **2026-10-21 · Capas de la app:** bloqueo de login por IP y por cuenta, IP real vía `trust proxy` loopback (antes se leía X-Forwarded-For falsificable), cookie SameSite=Strict + Secure bajo HTTPS, sesión 14 días, CORS cerrado, cabeceras de seguridad, `HOST` configurable (127.0.0.1 detrás de Caddy).
- **2026-10-21 · HTTPS hecho:** Caddy sirve la app en `https://metapulse.37-60-235-111.sslip.io`; `public_url_base` apunta ahí (Meta descarga las imágenes por esa URL); la app escucha solo en 127.0.0.1 (`HOST` en `.env` del servidor), así el puerto 3000 ya no es accesible desde afuera. Respaldo del Caddyfile en `/root/Caddyfile.bak.*`.
- **2026-10-21 · ufw activo (22/80/443) y SSH solo con llave** (`/etc/ssh/sshd_config.d/00-hardening.conf`). Para entrar desde otro PC: llave nueva por PC añadida a `/root/.ssh/authorized_keys`; si se pierde todo, consola VNC de Contabo.
- **2026-10-21 · VPN Tailscale:** el panel y la API solo se abren por `http://100.126.81.105` (red Tailscale, cifrada por WireGuard; Caddy en esa IP). La URL pública `https://metapulse.37-60-235-111.sslip.io` solo sirve `/uploads/*` (Meta descarga ahí las imágenes) y `/api/webhooks/meta`; el resto da 403. Respaldos del Caddyfile: `/root/Caddyfile.bak*`.
- **2026-10-21 · poleras (Streamlit, docker 8501) privado:** solo por Tailscale en `http://100.126.81.105:8502`; el dominio público da 403. **Freeze Turkey (puerto 8765, Caddy en `37-60-235-111.sslip.io`) sigue público** porque sus equipos sincronizan contra `https://37-60-235-111.sslip.io` (`cloud_sync.py`); cerrarlo exige cambiar esa URL en los clientes.
- **2026-10-21 · HTTPS por Tailscale (`tailscale serve`):** MetaPulse `https://vmi3557669.taile1b8f4.ts.net`, poleras `...:8443`, Freeze Turkey `...:10000` (solo tailnet). Pendiente: cambiar `cloud_server_url` de los clientes de Freeze Turkey a esa URL :10000 y luego cerrar su dominio público en Caddy.
- **Pendiente:** 2FA opcional

## Forma de trabajo
- **2026-10-14 · Claude orquesta, agy ejecuta.** Ahorra tokens de Claude; agy usa Gemini.
- **2026-10-15 · Menos pruebas duplicadas.** El subagente no repite pruebas que Claude hará; la UI la prueba el dueño.
- **2026-10-16 · Respuestas breves y concisas** en este proyecto.
- Cada cambio va a `main` y se despliega en Contabo, con respaldo previo de la BD.
