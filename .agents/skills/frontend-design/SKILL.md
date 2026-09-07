---
name: frontend-design
description: Directrices maestras de diseño y artesanía frontend basadas en los principios de diseño de interfaces web modernas. Se enfoca en la densidad equilibrada, jerarquía tipográfica, micro-interacciones pulidas, consistencia de componentes y eliminación de interfaces genéricas ("AI Slop").
---

# Frontend Design: Artesanía de Interfaces y Experiencia Visual

Este skill proporciona principios rigurosos para auditar y transformar interfaces web en experiencias visualmente impecables, con atención obsesiva al detalle, ritmo espacial y ergonomía de interacción.

---

## 1. Principios Fundamentales de Artesanía Frontend

### A. Tipografía Intencional y Jerarquía Clara
* **Escala de fuentes predecible:** No inventar tamaños arbitrarios. Usar una escala armónica:
  - `0.75rem` (12px) para badges, metadatos y timestamps.
  - `0.85rem` (13.6px) para labels de formularios y textos secundarios.
  - `0.95rem` / `1rem` (15-16px) para cuerpo principal y botones estándar.
  - `1.15rem` (18.4px) para subtítulos de tarjetas.
  - `1.4rem` - `1.75rem` para títulos de vista / headers.
* **Pesos (`font-weight`) con propósito:**
  - `400`: Texto de lectura corrida o párrafos largos.
  - `500`: Elementos interactivos normales, placeholders, navegación secundaria.
  - `600`: Etiquetas de formulario, títulos de tarjetas, botones primarios, badges destacados.
  - `700`: Cifras clave (KPIs), métricas principales, títulos de sección.
* **Contraste y legibilidad:**
  - Textos principales: Blanco brillante con tinte frío (`#f8fafc`).
  - Textos secundarios / descripciones: Gris azulado legible (`#94a3b8` a `#cbd5e1`), nunca un gris oscuro ilegible.
  - Textos muted: `#64748b`.

---

## 2. Ritmo Espacial y Contenedores

### A. La Regla de los Contenedores Limpios
* Cada tarjeta (`.card`, `.panel`, `.box`) debe tener una separación visual inequívoca pero suave:
  - Fondo: Superficie ligeramente más clara que el fondo general (`rgba(30, 41, 59, 0.65)` o `#1e293b`).
  - Borde: `1px solid rgba(255, 255, 255, 0.08)`.
  - Radio de borde armónico: `12px` o `16px`.
  - Sombra sutil de elevación: `box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.3)`.
* **Padding interno uniforme:** 16px a 24px en el cuerpo.
* Nunca dejar botones o textos tocando los bordes de su contenedor sin margen de seguridad.

### B. Distribución y Flujo
* Grillas (`display: grid`) y Flexbox (`display: flex`) con `gap` explícito (8px, 12px, 16px, 20px, 24px) en lugar de depender de márgenes flotantes impredecibles.

---

## 3. Botones y Elementos Interactivos

* **Feedback Visual Inmediato:**
  - Todo botón o enlace interactivo debe tener `cursor: pointer`.
  - Transición fluida: `transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)`.
  - Estados claros: `:hover`, `:active`, `:focus-visible`, y `:disabled`.
* **Alineación de Botones con Inputs:**
  - En cualquier barra de búsqueda o formulario en línea, los botones adyacentes deben tener exactamente la misma altura física (`height: 40px`, `box-sizing: border-box`).
* **Iconografía integrada:**
  - Iconos dentro de botones deben tener tamaño óptico proporcionado (`16px` a `18px`), con `margin-right: 6px` a `8px` y estar perfectamente centrados verticalmente (`align-items: center`).

---

## 4. Formularios de Alta Ergonomía

* **Inputs & Selects:**
  - Altura base estándar: `40px` (o `44px` en pantallas táctiles móviles).
  - Padding horizontal: `12px` a `14px`.
  - Bordes translúcidos con fondo oscuro suave: `background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.12);`.
  - Focus Ring: `box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25); border-color: #6366f1;`.
* **Agrupación de Acciones:**
  - En formularios, las acciones primarias deben ir a la derecha o destacadas al final del flujo de lectura.

---

## 5. Eliminación de Defectos Visuales Frecuentes

1. **Botones de distintos tamaños en una misma fila:** Forzar `height` o clases estandarizadas (`.btn-sm`, `.btn-md`, `.btn-lg`).
2. **Textos cortados o amontonados:** Usar `white-space: nowrap` en badges y botones con `flex-shrink: 0`.
3. **Scrollbars antiestéticas:** Usar `scrollbar-width: thin` y pseudo-elementos `::-webkit-scrollbar` discretos.
4. **Espacio muerto:** Equilibrar cards en dashboards para que las columnas tengan alturas similares o llenen el espacio disponible (`flex: 1`).
