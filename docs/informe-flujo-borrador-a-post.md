# Informe: flujo de borrador del plan a post listo (texto + imagen + agenda)

Fecha: 2026-10-16. Estado: diagnóstico y propuesta. Nada de esto está implementado salvo lo ya desplegado (commit `ac191e5`).

## 1. Cómo funciona hoy (lo que encontré en el código)

Recorrido real del dueño, con los saltos manuales marcados con (M):

1. Planificador del mes crea borradores: `createDraftsFromPlan` guarda copy, título (= ángulo) y, desde hoy, `plan_context`.
2. (M) Calendario → borrador → Editar → se abre el Creador.
3. El Creador dispara solo la tarjeta "Imagen sugerida para Gemini" (`suggestImagePrompt`): un prompt **genérico**, sin paleta, sin tipografía, sin escena, sin campaña real.
4. (M) Aparte, hay que abrir el modal "Asistente IA → La Campiña", que es **otro sistema de prompts** (maestro + estilos + titulares). Ese modal arranca en blanco salvo lo que ahora se prellena.
5. (M) Subir foto real, rellenar o aprobar titular, generar prompt, copiar, abrir Gemini web, adjuntar foto, pegar, esperar.
6. (M) Descargar la imagen de Gemini, subirla al Creador.
7. (M) Revisar texto, elegir fecha, guardar (reemplaza el borrador).

## 2. Problemas de fondo (causas, no síntomas)

| # | Problema | Evidencia | Consecuencia |
|---|---|---|---|
| P1 | **Dos sistemas de prompt que no se hablan**: tarjeta "Imagen sugerida" (genérica, sin texto) y Prompt Maestro de Campiña (con texto y estilos). | `suggestImagePrompt` vs `buildCampinaImagePrompt` | Ves dos prompts distintos para el mismo post; ninguno tiene todo el contexto. |
| P2 | **Contradicción de política sobre el texto en la imagen.** Decisión del 2026-10-15: "la imagen se genera sin texto". El maestro de Campiña pide a Gemini dibujar el titular. | `docs/decisions.md` vs plantilla del maestro | Ortografía y tildes impredecibles, y resultados que cambian cada vez. |
| P3 | **El tema se copia crudo.** "Descuento adultos mayores" es la etiqueta del plan, no un enfoque trabajado (público, beneficio, condiciones, tono). | `loadPostIntoComposer` copia `angle` | El prompt parte de 3 palabras en vez de un brief. |
| P4 | **"Ocasión" solo llega en planes nuevos.** El borrador anterior no la tiene, y el modelo la devolvía como texto libre ("Fin de semana normal"). | `plan_context` es nuevo | Quedó vacía. |
| P5 | **La IA razona tarde y por partes.** Titular, paleta, escena y copy se calculan en llamadas separadas, sin un brief único compartido. | `generateCampinaContent` | Incoherencias (copy habla de familia, imagen de pareja). |
| P6 | **El modal es un flujo aparte del Creador.** | UI | Fricción: hay que saber que existe y abrirlo en cada borrador. |
| P7 | **La foto la eliges tú cada vez y la IA no sabe qué fotos tienes.** | `campina-bg-*` | No puede decir "usa la del pastizal"; depende de que subas la correcta. |
| P8 | **Promos sin datos duros.** "Descuento adultos mayores" no trae % ni condiciones ni vigencia en el borrador. | campaña = texto libre del cliente | El prompt no debe inventar cifras; hoy no tiene de dónde sacarlas. |
| P9 | **Sin bucle de calidad.** No se registra qué imagen salió buena. | Fase 2 pendiente | El sistema no mejora con el uso. |
| P10 | **Texto y cantidad de pasos manuales:** ~10 clics/pegados por post. | recorrido | Con 12 posts al mes es mucho. |

## 3. Arquitectura propuesta: un "Brief visual" por post

Idea central: **una sola llamada de IA razona el post completo y guarda un brief**; todo lo demás (copy, titulares, escena, prompt) consume ese brief. Se guarda en `posts.plan_context` (o columna `visual_brief`).

```
Brief visual = {
  tema_trabajado,      // 1-2 frases: qué se comunica y a quién
  ocasion,             // fecha concreta o temporada, derivada del calendario
  publico, beneficio, tono,
  datos_duros: { promo, condiciones, vigencia }  // SOLO de la ficha de campaña; faltantes = "por confirmar"
  espacio_recomendado, foto_a_usar,
  titulares[5], estilo, paleta, acabado,
  escena (indicaciones), prompt_final
}
```

Pipeline por post (un botón "Preparar post", o automático al crear borradores):

1. **Analizar**: lee campaña vigente + ángulo + gancho + calendario → arma el brief (razonamiento por pasos, igual que la escena).
2. **Elegir foto** de la biblioteca aprobada según espacio y público (o pedir subir una si no hay).
3. **Titulares** (5, memoria anti-repetición) y selección por reglas: el primero se aplica, los otros quedan como pastillas.
4. **Escena**: deducida con la foto + brief.
5. **Un único prompt final** = directrices de marca (maestro) + bloque del post (escena + titular). Un solo botón copiar.
6. **Revisor previo** (checklist automático): coherencia copy/imagen, cifras solo de la ficha, sin tinajas, sin falsas urgencias, ortografía del titular.
7. **Imagen** → subir resultado → se adjunta al borrador → **agendar**.

## 4. Soluciones por problema

- **P1/P6**: fusionar en un panel "Imagen del post" dentro del Creador, sin modal. La tarjeta genérica se reemplaza por el prompt unificado.
- **P2**: ver pregunta Q2. Recomendado: imagen sin texto + titular compuesto por MetaPulse (tipografía vectorial ya existe en `imageService`), o modo híbrido.
- **P3/P5**: paso "Analizar" que devuelve el brief; el campo Tema muestra `tema_trabajado`, no el ángulo crudo.
- **P4**: la ocasión se calcula en código (fecha del borrador + feriados de Chile) y la IA solo la redacta.
- **P7**: biblioteca de fotos aprobadas por marca, etiquetadas por espacio (pastizal, cabaña, suite, quincho, sendero, terraza). La IA elige y tú confirmas.
- **P8**: la ficha de campaña gana campos estructurados (porcentaje, condiciones, vigencia, días). Si faltan, el post sale sin cifra y el sistema te lo avisa.
- **P9**: botones "Esta imagen quedó buena / mala" con motivo; se inyecta en prompts siguientes.
- **P10**: modo lote: preparar todos los borradores del mes de una vez (secuencial, por cuota gratuita).

## 5. Mejoras al prompt maestro (pendientes de aprobación)

Las A–G de `docs/auditoria-prompt-maestro.md` más:
- H. Una sola versión del prompt por marca, con la parte fija separada de la parte variable (facilita probar cambios).
- I. Salida pedida a Gemini: "una sola imagen", y formato 4:5 o 9:16 según el post.
- J. Cuando hay personas, definir cantidad, edad y encuadre, para que "adultos mayores" no se vuelva estereotipo ni cara en primer plano.

## 6. Riesgos y límites

- Cuota gratuita de Gemini: modo lote = ~3-4 llamadas por post; hay que espaciarlas.
- Gemini web no tiene API gratuita de imagen en este flujo: seguirá habiendo un paso manual de pegar y descargar.
- Un brief errado se propaga a todo; por eso el revisor previo y el campo editable.

## 7. Plan por fases (si apruebas)

- **Fase 1 (rápida)**: tema trabajado y ocasión reales al abrir el borrador; unificar prompt (P1, P3, P4, P5).
- **Fase 2**: panel "Imagen del post" en el Creador y biblioteca de fotos (P6, P7).
- **Fase 3**: titular compuesto o híbrido, según Q2 (P2).
- **Fase 4**: ficha de campaña estructurada, revisor previo, lote, bucle de calidad (P8, P9, P10).

## 8. Decisiones del dueño (2026-10-16)

- Q1: panel dentro del Creador (sin modal), un solo prompt unificado.
- Q2: **Gemini dibuja el titular**. Se mantiene el estilo artístico; se endurece el prompt contra errores de ortografía (texto exacto entre comillas, tildes y ñ, "no agregar otro texto") y se ofrece regenerar.
- Q3: un botón "Preparar post" por borrador.
- Q4: la foto se sube cada vez; la IA indica qué tipo de foto conviene (espacio y encuadre) en vez de usar biblioteca.
