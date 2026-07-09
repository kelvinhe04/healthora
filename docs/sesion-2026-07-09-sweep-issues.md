# Sesión 2026-07-09 — Barrido de issues + auditoría de numeración HU

Registro de lo hecho en esta sesión de trabajo remoto (issue por issue), para revisión posterior. No reemplaza `docs/seguimiento-hu.md` (esa sigue siendo la tabla viva de HU↔rama/PR) — esto es la bitácora de decisiones y hallazgos de la sesión.

---

## 1. Limpieza inicial de issues

Tres issues seguían **abiertas en GitHub** aunque su PR ya estaba mergeado, porque el PR usaba la palabra clave de cierre en **español** ("Cierra #N"), que GitHub no reconoce (solo reconoce `Closes`/`Fixes`/`Resolves` en inglés):

| Issue | PR que ya lo resolvía | Acción |
|---|---|---|
| #179 | PR #180 (mergeado) | Cerrada manualmente + status "Done" en el Project |
| #181 | PR #182 (mergeado) | Cerrada manualmente + status "Done" en el Project |
| #183 | PR #184 (mergeado) | Cerrada manualmente + status "Done" en el Project |

A partir de esta sesión, los PRs usan `Closes #N` (inglés) para que el auto-close de GitHub funcione.

---

## 2. Auditoría de numeración HU (colisión HU-061 / HU-062)

### Hallazgo inicial

Las issues #95 y #96 (historias nuevas, "Suscripción de reposición automática" e "Recordatorio de recompra", salidas de un brainstorm de retención) estaban tituladas **HU-061** y **HU-062** — números ya usados por trabajo real y distinto:
- **HU-061** ya designaba "Notificaciones en tiempo real (WebSockets)" — implementada, PR #170, cierra issue #65.
- **HU-062** ya designaba "Rate limiting" — pendiente, asignada a Roy.

### Investigación

Se revisó `deliverables/Healthora-Historias-de-Usuario.docx` (fuente formal) a fondo:

- El cuerpo del documento (los encabezados "HU-XXX - Título") tenía las 2 historias nuevas insertadas en HU-061/HU-062, y **todo lo que venía después se había corrido +2** sin que nadie lo propagara de vuelta al resto del proyecto: Notificaciones pasó a figurar como "HU-063", Rate limiting como "HU-064", Zod como "HU-065", etc., hasta (al menos) "HU-087 Búsqueda simple de productos".
- Dos tablas resumen **dentro del mismo documento** (tabla de "Requisitos Funcionales nuevos (32)", sección 3, y la tabla "Resumen de Historias MCP", sección 6) **nunca se actualizaron** tras esa inserción: ambas seguían diciendo `HU-061 = Notificaciones en tiempo real`, y no listan las 2 historias nuevas en absoluto. Es decir, el propio documento se contradecía internamente (encabezados vs. tablas resumen).
- Estas dos tablas, más `docs/seguimiento-hu.md`, más la lista de issues pendientes de Roy, más 2 issues de GitHub ya existentes (#83 = HU-079 "Cola de emails", #88 = HU-084 "Internacionalización") — **cuatro fuentes independientes** — coinciden entre sí y confirman cuál era la numeración correcta antes de la inserción.

### Decisión y corrección aplicada

Se restauró la numeración original de los encabezados desde "HU-063" hasta "HU-087" (26 historias), corriéndolos **-2** de vuelta a su número real (verificado 1 a 1 contra `seguimiento-hu.md` / issues de GitHub / lista de Roy, sin una sola discrepancia en ese rango). Las 2 historias nuevas (antes HU-061/HU-062) se renumeraron a **HU-101 / HU-102** (siguientes números libres tras HU-100), tanto en el `.docx` como en los títulos de las issues #95/#96 en GitHub.

También se actualizaron las 2 menciones sueltas en la sección "8. Roadmap de priorización" que citaban los números viejos (desplazados) de HU-064/065/066/068/072/075/079/080, ahora correctas.

El PDF (`deliverables/Healthora-Historias-de-Usuario.pdf`) se regeneró desde el `.docx` ya corregido vía automatización de Word (mismo método usado en el commit `9b8ca4a`), 41 páginas, sin pérdida de contenido (verificado por conteo de párrafos/tablas antes/después y escaneo completo de IDs "HU-\d+": 93 IDs únicos antes y después, con el único cambio siendo `HU-086`/`HU-087` removidos de la lista de "usados dos veces" y `HU-101`/`HU-102` agregados).

**Nada se eliminó** — todo el contenido de las 2 historias de retención sigue íntegro, solo con número distinto.

### ⚠️ Zona sin resolver (dejada intacta a propósito)

A partir de **HU-088** ("Pulido de experiencia responsive en móvil y tablet") la evidencia se vuelve contradictoria: si el mismo patrón de corrimiento +2 se sostuviera, HU-088 debería corresponder al HU-086 rastreado — pero `seguimiento-hu.md` dice que HU-086 es "Documentación API (OpenAPI/Swagger)" (un título totalmente distinto). Y el siguiente número, HU-091 ("Migración del frontend a TanStack Start"), **ya coincide exactamente** con `seguimiento-hu.md` sin ningún corrimiento — lo cual contradice que el corrimiento +2/+3 se mantenga hasta ahí.

No se tocó **nada** en el rango HU-088 a HU-091 (4 historias: Pulido responsive, OpenAPI, Refactor admin, TanStack) porque no hay evidencia suficiente para saber con certeza qué número le corresponde a cada una sin arriesgarse a introducir un error nuevo. Queda pendiente de revisión manual si en algún momento se quiere resolver del todo.

**Cómo revisarlo vos mismo si querés confirmar/corregir:** abrí el `.docx`, sección "4.7 UX / Calidad" en adelante — compará el encabezado "HU-088 - Pulido de experiencia responsive..." (¿es una historia real, tiene issue de GitHub, o es contenido huérfano de otra inserción sin terminar de propagar?) contra la fila de HU-086/087/088 en `seguimiento-hu.md`.

---

## 2 issues más trabajadas en esta sesión

_(se completa esta sección al terminar cada una)_

<!-- issue-log-placeholder -->
