---
name: ui-ux-pro-max
description: Motor de inteligencia y auditoría de diseño UI/UX para interfaces web SaaS, dashboards y componentes frontend. Aplica el sistema de espaciado 8pt grid, jerarquía tipográfica, estandarización de botones, armonía de bordes translúcidos (estilo Linear/Raycast), ergonomía de formularios y erradicación de AI Slop.
---

# UI/UX Pro Max: Directrices Maestras de Diseño Frontend y Estética SaaS

Este documento codifica las reglas maestras de diseño visual, ergonomía y pulido de interfaz (UI/UX) para aplicaciones web profesionales, eliminando el diseño genérico o descuidado ("AI Slop") y elevando la experiencia a un estándar visual premium (estilo Linear, Raycast o Vercel).

---

## 1. Principios Fundamentales (Anti-AI Slop & Craft)

1. **Rechazo a lo Genérico:**
   - Cero sombras negras duras (`box-shadow: 0 10px 20px #000`).
   - Cero bordes blancos opacos estridentes (`border: 1px solid #fff`).
   - Cero alturas arbitrarias o dispares entre elementos adyacentes (un botón de 36px no puede estar al lado de un input de 44px).
2. **Capas de Fondo en Modo Oscuro (Layering de Profundidad):**
   - **Canvas / Fondo Global:** Color más profundo (ej: `#0b0f19` o `#0f172a`).
   - **Superficie de Tarjetas (Cards):** Un tono más claro (ej: `#131b2e` o `rgba(30, 41, 59, 0.7)` con backdrop-filter).
   - **Superficie Sutil (Inputs / Zonas de Contraste):** `rgba(15, 23, 42, 0.6)`.
   - **Bordes de Luz Perimetral:** `1px solid rgba(255, 255, 255, 0.08)` (en hover: `rgba(255, 255, 255, 0.16)`).

---

## 2. Grilla Matemática de Espaciado (8pt Grid System)

Todos los márgenes (`margin`), rellenos (`padding`) y distancias entre elementos (`gap`) deben respetar múltiplos estrictos de 4px y 8px:

| Token | Valor | Uso Exclusivo |
| :--- | :--- | :--- |
| **Micro (4px)** | `4px` | Espacio entre icono y texto, padding interno de badges/pills. |
| **Compact (8px)** | `8px` | Espaciado entre botones de un toolbar, margen inferior de labels a inputs. |
| **Regular (12px)** | `12px` | Padding interno de inputs estándar, gap en grids densos. |
| **Base (16px)** | `16px` | Padding interno de tarjetas secundarias, margen inferior entre campos de formulario. |
| **Medium (20px-24px)**| `20px` / `24px` | Padding de tarjetas principales (Cards), separación entre grupos mayores. |
| **Large (32px)** | `32px` | Separación vertical entre filas principales de un dashboard. |

---

## 3. Sistema de Botones y Jerarquía de Acciones

Los botones deben tener **alturas estandarizadas, bordes redondeados armónicos y micro-interacciones**:

### A. Escala de Alturas
* **Botón XS (Etiquetas / Filtros):** `height: 28px; padding: 0 10px; font-size: 0.74rem; border-radius: 6px;`
* **Botón SM (Acciones secundarias / Tablas):** `height: 34px; padding: 0 14px; font-size: 0.82rem; border-radius: 8px;`
* **Botón Base (Acción estándar de formularios):** `height: 40px; padding: 0 18px; font-size: 0.88rem; border-radius: 8px;`
* **Botón LG (Call to Action / Hero):** `height: 48px; padding: 0 24px; font-size: 0.95rem; border-radius: 10px;`

### B. Variantes Semánticas
* **Botón Primario:**
  - Fondo acento vibrante (gradiente sutil índigo/violeta o rosa/morado).
  - Sombra difusa de color: `box-shadow: 0 2px 10px rgba(99, 102, 241, 0.35)`.
  - En hover: elevación de 1px (`transform: translateY(-1px)`).
* **Botón Secundario:**
  - Fondo superficie (`var(--bg-surface)`), borde translúcido `1px solid rgba(255, 255, 255, 0.12)`.
  - Texto color secundario claro (`#cbd5e1`).
* **Botón Ghost:**
  - Fondo transparente, sin borde visible en reposo. En hover: fondo `rgba(255, 255, 255, 0.06)`.
* **Botón Danger / Destructivo:**
  - Borde o fondo carmín tenue (`rgba(239, 68, 68, 0.12)`), texto rojo vibrante (`#ef4444`).

---

## 4. Ergonomía de Formularios e Inputs

1. **Alineación Vertical Idéntica:**
   - Cuando un `input`, `select` y `button` estén en la misma fila (`display: flex`), **todos deben compartir exactamente la misma altura (ej: 40px)**.
2. **Labels y Descripciones:**
   - La etiqueta siempre debe tener `font-weight: 600`, tamaño `0.82rem` a `0.85rem` y `margin-bottom: 6px`.
   - Si hay texto de ayuda (`small.form-hint`), debe estar a `0.75rem` con color atenuado (`#94a3b8`) y un margen superior de `4px`.
3. **Focus States Accesibles (Focus Rings):**
   - Al recibir foco, nunca dejar el contorno feo del navegador.
   - Usar: `outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);`.

---

## 5. Tarjetas, Paneles y Cabeceras

1. **Estructura Interna de una Card:**
   - **Header:** `display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);`.
   - **Body:** Padding consistente de 20px.
   - **Footer:** `border-top: 1px solid rgba(255,255,255,0.06); padding: 14px 20px; background: rgba(0,0,0,0.1);`.
2. **Radio de Curvatura Armónico:**
   - Contenedor exterior: `border-radius: 12px` o `14px`.
   - Elementos interiores (botones, inputs, badges): `border-radius: 6px` a `8px`.
   - Regla de oro: El radio interno siempre debe ser menor o igual al radio del contenedor padre.

---

## 6. Lista de Verificación (Audit Checklist)

Antes de dar por finalizado un ajuste de UI, auditar visualmente:
- [ ] **Sincronización de alturas:** ¿Todos los botones e inputs adyacentes miden lo mismo?
- [ ] **Respiro perimetral:** ¿Hay algún texto o botón pegado al borde de una tarjeta sin al menos 12px de padding?
- [ ] **Micro-interacciones:** ¿Todos los elementos clickeables tienen `cursor: pointer` y cambio de estado suave (`transition: all 0.15s ease`)?
- [ ] **Consistencia de radios:** ¿Tienen los botones y tarjetas bordes redondeados coherentes en toda la vista?
- [ ] **Scrollbars:** ¿La barra de scroll está estilizada con tonos oscuros y bordes redondeados en lugar de la gris por defecto del navegador?
- [ ] **Contrastes:** ¿Todos los textos secundarios son perfectamente legibles sin forzar la vista?
