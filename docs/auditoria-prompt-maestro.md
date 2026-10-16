# Auditoría del Prompt Maestro (La Campiña)

Fecha: 2026-10-16. Alcance: `buildCampinaImagePrompt`, `extractCampinaVisualHierarchy`, `analyzeCampinaArtDirection`, catálogos y detectores en `src/services/aiService.js`.
Estado: **solo diagnóstico. El texto del prompt maestro NO se ha modificado.** Cada mejora espera aprobación del dueño.

## Qué está bien (se conserva)
- Regla de fidelidad fotográfica (bloque 1) y prohibición de tinajas/hot tubs.
- Lockup con contraste interno (palabra clave vs. complementarias), acabado de marca, textura y sombra de contacto.
- Cero texto de relleno: solo Hero + subtítulo + identidad discreta.
- Paletas con restricción de colores prohibidos (cero dorado genérico).

## Hallazgos (de mayor a menor impacto)

1. **Titulares repetidos: causa raíz.** `extractCampinaVisualHierarchy` es una cascada de `if` por palabra clave con textos fijos ("MOMENTOS AL FUEGO", "TU REFUGIO NATURAL"...). `analyzeCampinaArtDirection` corre a temperatura 0.5, se cachea 24 h por (tema, fecha), tiene timeout de 8 s y ante cualquier fallo cae en silencio al catálogo fijo. No hay memoria de titulares ya usados ni lista de prohibidos.
2. **Detectores con falsos positivos.** `detectCampinaColorPalette`/`PosterReference`/`Typography` usan `includes('18')`, `'fiesta'`, `'mar'`, `'sol'`: "Año Nuevo con fiesta" cae en paleta **Fiestas Patrias**; "18:00" o "solo" también disparan reglas. Año Nuevo, Navidad, primavera e invierno no tienen paleta propia.
3. **Supone fondo de madera.** Las paletas y el bloque 4c hablan de "sombra de contacto sobre la madera" y "rótulo de madera". Con una foto de pastizal, cielo o suite eso induce a Gemini a inventar madera. Debe decir "sobre la superficie/escena de la foto".
4. **Contradicción latente con la escena.** El bloque 1 prohíbe cualquier cambio; añadir personas (familia jugando) exige una excepción explícita con precedencia. Hoy no existe (se resuelve con el bloque nuevo de indicaciones del post).
5. **`gold_foil` contradice "cero dorados".** El detector asigna pan de oro a todo estilo `kinfolk_luxury`, aunque la paleta prohíba dorados.
6. **Sin zonas seguras.** No indica márgenes ni que el titular sobreviva al recorte 1:1 / 3:4 de la grilla de Instagram ni a la UI (avatar, botones).
7. **Sin lista negativa de artefactos de IA.** Falta: sin manos/rostros deformados, sin logos ni marcas de agua inventados, sin texto extra, sin ortografía errónea (tildes, ñ), "entrega 1 sola imagen".
8. **Sin variedad de composición.** Siempre "lockup" centrado; no se pide alternar posición del titular (tercio superior/inferior/lateral) según el espacio libre de la foto.
9. **Duplicación.** `generateCampinaContent` repite la lógica de selección de estilo/acabado/paleta/referencia de `buildCampinaImagePrompt`. Un cambio hay que hacerlo en dos sitios.
10. **Inconsistencias menores.** Hero "2 a 3 palabras" en UI vs. "2 a 4" en el prompt de Agendio; subtítulo "máx. 6 palabras" pero los fallbacks tienen 8-10.

## Mejoras sugeridas (pendientes de tu aprobación)
- A. Reemplazar "sobre la madera" por "sobre la escena fotográfica" (hallazgo 3).
- B. Añadir línea de precedencia: "Los bloques de indicaciones del post pueden añadir personas/ambiente pequeños en segundo plano; la arquitectura y la vegetación siguen intactas" (hallazgo 4).
- C. Añadir bloque "Zonas seguras y legibilidad" (márgenes ≥ 8 %, titular en tercio con más aire, contraste mínimo, resistir recorte 1:1).
- D. Añadir bloque "Control de calidad": lista negativa de artefactos + una sola imagen + revisión de ortografía.
- E. Pedir a Gemini que elija la posición del titular según el espacio libre real de la foto.
- F. Que `gold_foil` solo aplique si la paleta lo permite.
- G. Unificar la selección de estilo/paleta en un único helper.

## Lo que SÍ se aplica ahora (catálogos y lógica, no el texto del prompt)
- Titulares generativos con memoria anti-repetición.
- Detectores corregidos (límites de palabra; Año Nuevo/Navidad antes que Patrias).
- Nuevos estilos tipográficos, acabados, paletas y referencias de afiche.
- Recuadro aparte de indicaciones del post (escena, personas, ambiente).
