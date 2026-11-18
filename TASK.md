# TASK — Reels: efectos de texto de entrada, animación continua y salida

Respaldo: etiqueta git `reels-v2`. Ejecutor: NO hacer commit. Respetar los saltos de línea de cada archivo. No leer completos los archivos grandes: usar grep y rangos.

## Archivos permitidos
- `src/services/reelStudioService.js`
- `public/js/reelStudio.js`
- `public/css/style.css`
- `public/index.html` (solo cache busters: `style.css?v=3.6`, `reelStudio.js?v=2.8`)

## Modelo de datos
Cada overlay de texto pasa de un solo `effect` a:
- `effectIn` (entrada), `effectLoop` (mientras está en pantalla), `effectOut` (salida)
- `speed`: `'fast' | 'normal' | 'slow'` → duración de la entrada y de la salida: 0.25 / 0.45 / 0.8 s. Si el texto dura poco, ambas se acortan para que entrada + salida <= 70 % de `end - start`.

Compatibilidad: si un overlay trae solo `effect` (borradores y respuestas viejas de la IA), convertir así: `pop→pop`, `fade→fade` (y `effectOut=fade`), `slide→slideup`, `bounce→bounce`, `none→none`. `effectLoop` por defecto `none`, `effectOut` por defecto `fade`.

Definir las listas UNA sola vez en el servicio (`TEXT_EFFECTS_IN`, `TEXT_EFFECTS_LOOP`, `TEXT_EFFECTS_OUT`, con `{ id, label }` en español) y usarlas en todas las validaciones que hoy repiten `['pop','fade','slide','bounce','none']` (líneas ~324, ~416 y ~665). Exportarlas. En el front, la misma lista copiada (no hay build) en `reelStudio.js`.

## Catálogo
Entrada (`effectIn`):
| id | Nombre | Cómo se ve |
|---|---|---|
| `pop` | Punch / Pop | el actual: cae un poco con alfa rápido |
| `zoomin` | Zoom in | crece de 30 % a 100 % con leve rebote (overshoot 108 %) |
| `zoomout` | Zoom desde cerca | baja de 180 % a 100 % con fundido |
| `typewriter` | Máquina de escribir | aparecen las letras una a una (de izquierda a derecha) |
| `wordbyword` | Palabra por palabra | aparecen las palabras una a una (estilo Hormozi) |
| `wind` | Viento | entra desde la izquierda con estela: 2 copias fantasma detrás (alfa 0.35 y 0.15, desfasadas 40 y 80 px) que se juntan con el texto |
| `magic` | Magia | parpadeo/destello (alfa oscilante que se estabiliza) + zoom 70→100 % + halo: copia detrás, un poco más grande, color claro, alfa que baja a 0 |
| `glitch` | Glitch | sacudida horizontal + copias roja y cian desplazadas ±8 px que desaparecen al terminar la entrada |
| `slideup` / `slidedown` / `slideleft` / `slideright` | Deslizar | entra desde ese lado con fundido |
| `drop` | Caída con rebote | cae desde arriba de la pantalla y rebota 2 veces |
| `bounce` | Rebote | el actual |
| `fade` | Fundido | alfa de 0 a 1 |
| `none` | Corte directo | |

Animación continua (`effectLoop`, entre el fin de la entrada y el inicio de la salida):
| id | Nombre | Cómo se ve |
|---|---|---|
| `none` | Quieto | |
| `float` | Flotar | `y += 10*sin(2π·t/2.2)` |
| `pulse` | Latido suave | tamaño ±4 % con período de 1.2 s |
| `heartbeat` | Corazón | doble pulso cada 1 s (+6 %) |
| `shake` | Temblor | jitter horizontal ±4 px de alta frecuencia |
| `swing` | Vaivén | `x += 14*sin(2π·t/1.6)` |
| `glow` | Respirar | alfa entre 0.8 y 1 |
| `wave` | Ola | cada línea flota desfasada (por índice de línea) |

Salida (`effectOut`): `fade`, `zoomout` (encoge a 0 con fundido), `explode` (crece a 160 % y se desvanece), `slideup`, `slidedown`, `slideleft`, `slideright`, `wind` (se va a la derecha con estela), `magic` (destello y se disuelve), `glitch`, `typewriter` (se borran las letras de derecha a izquierda), `drop` (cae fuera de la pantalla), `none`.

## Render (servidor, `render()` alrededor de las líneas 655-720)
Construir las expresiones de `drawtext` para `x`, `y`, `alpha` y `fontsize`. Ya está verificado que `fontsize` acepta expresiones con `t` que se evalúan en cada cuadro.
- Centrado: `x=(w-text_w)/2 + dx(t)` y `y = centroLinea - text_h/2 + dy(t)`, para que el zoom crezca desde el centro.
- Para cada línea `k`: `tIn0 = start + k*0.08` (el escalonado de hoy), `tInEnd = tIn0 + inDur`, `tOut0 = end - outDur`. Usar una variable de progreso `p = clip((t - tIn0)/inDur, 0, 1)` y `q = clip((t - tOut0)/outDur, 0, 1)`, con easing `easeOutBack` y `easeOutCubic` escritos como expresiones.
- Componer: valor final = entrada(p) aplicada si `t < tInEnd`, loop si `tInEnd <= t < tOut0`, salida(q) si `t >= tOut0`. Usar `if(lt(t,..),..)` anidados. Hacer una función por efecto que devuelva `{ dx, dy, alpha, scale }` como strings de expresión, y armarlas al final (`fontsize = round(base*scale)`).
- Escapar las comas dentro de las expresiones como ya se hace (comillas simples alrededor de la expresión) y probarlo.
- **typewriter / wordbyword:** un `drawtext` por prefijo (letra o palabra), cada uno con su ventana `enable`. Para que el texto crezca de izquierda a derecha sin moverse, el `x` de todos los prefijos debe ser el de la línea completa: dibujar la línea completa con `alpha=0` no sirve para medir, así que hay que calcular el ancho con la fuente. Usar `sharp` (ya instalado) para renderizar la línea con `fontfile` y obtener su ancho en px al `fontsize` base; si no es confiable, usar el prefijo centrado (crece desde el centro). Máximo 30 pasos por línea (agrupar letras si son más). La salida `typewriter` hace lo mismo en orden inverso.
- **wind / magic / glitch:** las capas extra son `drawtext` adicionales del mismo texto con su propio `alpha`/`x`/`fontcolor`, activas solo durante la entrada o la salida (`enable`). Van ANTES de la capa principal, para que queden detrás.
- Con estilos de caja (`box=1`), las capas fantasma se dibujan sin caja.
- Límite: máximo 120 `drawtext` en total por render. Si se pasa, degradar typewriter → fade y quitar las capas fantasma, y anotar en `console.warn`.

## IA (`suggestTextOverlays` y el plan del guion)
Actualizar el prompt para que devuelva `effectIn`, `effectLoop`, `effectOut` y `speed`, con la lista de ids válidos y una guía corta: gancho inicial → `zoomin`/`glitch`/`magic`; listas → `wordbyword`; cierre/CTA → `pop` + `pulse`; atmósfera → `fade` + `float`. Validar contra las listas.

## Front (`reelStudio.js` + `style.css`)
- En cada tarjeta de texto (paso 4), reemplazar el selector de efecto por cuatro: "Entrada", "Animación", "Salida" y "Velocidad". Guardarlos en el estado y en `localStorage`, con la migración del campo viejo `effect` al restaurar.
- "Aplicar esta fuente y estilo a todos" también copia los cuatro.
- Vista previa en la mini pantalla (botón "Previsualizar" del texto y reproductor de secuencia):
  - Entrada y salida con `@keyframes` CSS (`reel-in-<id>`, `reel-out-<id>`) y la duración según `speed`.
  - El loop con keyframes infinitos (`reel-loop-<id>`) que se aplican al terminar la entrada.
  - La salida se dispara a `end - outDur`.
  - typewriter / wordbyword: revelar con JS (spans) en vez de CSS.
  - glitch / wind / magic: `text-shadow` animado o pseudo-elementos. Basta con una aproximación fiel.
- "Previsualizar" de un texto reproduce entrada → 1.5 s de loop → salida, una vez.
- Usar el reloj del reproductor de secuencia (de la tarea anterior, ya en el código) para decidir el estado de cada texto según `t`; si se arrastra la barra, mostrar el estado de ese momento sin reiniciar animaciones de forma rara.

## Verificación (el ejecutor la corre y reporta)
1. `node --check` en los JS tocados.
2. Script de humo en la carpeta temporal del sistema con `NODE_PATH="C:/Users/aaaa/proyecto manejo redes sociales/node_modules"`:
   - 1 video `testsrc` de 6 s en `uploads/reels/tmp/`.
   - Llamar a `render` con 4 textos que cubran: `typewriter`+`float`+`fade`, `magic`+`pulse`+`explode`, `glitch`+`shake`+`glitch`, `wind`+`none`+`wind`, con estilos `yellow` e `impact`.
   - Que genere el MP4 sin error. Extraer 6 cuadros PNG (a la mitad de cada entrada y de cada salida) a la carpeta temporal y listar sus rutas en el reporte, para que Claude los mire. Borrar después el MP4 y los videos de prueba (los PNG no).
   - Probar también un overlay viejo con solo `effect: 'slide'`.
3. No llamar a Gemini.

## Reporte
Archivos tocados, resumen, salida de la verificación, rutas de los PNG y lo que quedó sin verificar.
