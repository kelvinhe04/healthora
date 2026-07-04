# Seguimiento de Historias de Usuario — Proyecto Semestral

Registro vivo de qué HU está hecha, en curso o pendiente, con su rama/PR. Actualizar esta tabla cada vez que se abre o mergea un PR — es la referencia rápida para la demo en clase (el detalle fino de cada feature va en su propio doc, ej. `docs/product-variants.md`).

---

## Convención

- **Rama**: `feat/hu-XXX-nombre-corto`, siempre creada desde `main` actualizado.
- Al mergear un PR, mover la fila a "Completadas" y anotar el PR.
- No reabrir una HU "Completa" solo porque falta contenido/datos — eso es una HU de contenido aparte (ver sección Backlog de contenido).

---

## Completadas (mergeadas a `main`)

| HU | Título | Rama / PR | Responsable | Notas |
|---|---|---|---|---|
| HU-005 | Selector de variantes en la ficha | `feat/product-variants` / PR #98 | Kelvin | Selector completo (tamaño/sabor/conteo/color), precio e imagen reactivos. Falta reseed de categorías restantes (contenido, no bloquea — ver Backlog de contenido). |
| HU-035 | Variante seleccionada persistida en el carrito | `feat/product-variants` / PR #98 | Kelvin | `cartStore`/`CartDrawer` soportan `productId+variantId`. Bug de imagen (no reflejaba la variante en carrito/checkout) corregido en el mismo PR. |

## En curso

| HU | Título | Rama | Responsable | Notas |
|---|---|---|---|---|
| HU-033 | Precio por variante aplicado en checkout | por crear | Kelvin | Parcial ya en `main`: cálculo de subtotal en frontend correcto; falta validar precio de variante en backend al confirmar la orden. |

## Pendientes — continuación directa de variantes (Kelvin, ramas nuevas tras el merge)

| HU | Título | Depende de | Notas |
|---|---|---|---|
| HU-032 | Gestión de variantes desde el panel admin | merge de `feat/product-variants` | Sin UI ni endpoints de admin para variantes todavía. |
| HU-034 | Stock por variante (enforcement) | HU-032 | Campo `stock` ya existe en el schema; falta que el backend lo valide/descuente al hacer checkout. |
| HU-036 | Variante registrada en las órdenes | HU-034 | `Order.ts` no guarda qué variante se compró. |
| HU-037 | Enforcement de stock (inventario) | HU-034/036 | Hoy el chequeo de stock es solo client-side (`cartStore`). |

## Pendientes — asignadas a Roy (infra, sin tocar código de producto/variantes)

Ramas secuenciales desde `main` (una a la vez, todas tocan `backend/src/index.ts`, mergear una antes de abrir la siguiente):

| Orden | HU | Título |
|---|---|---|
| 1 | HU-062 | Rate limiting |
| 2 | HU-064 | Security headers (CSP, HSTS, X-Frame) |
| 3 | HU-065 | Logs de auditoría de seguridad |
| 4 | HU-066 | Logging estructurado |
| 5 | HU-067 | Error tracking con PostHog |
| 6 | HU-068 | APM y métricas de rendimiento |
| 7 | HU-069 | Alertas y monitoreo de uptime |

En pausa hasta que variantes/UI se estabilicen: HU-063 (Zod — toca schemas de producto/cart/checkout), HU-070/071/072 (tests), HU-080/081 (optimización de imágenes / HTTP cache — tocan `ProductCard`/`ProductImage`, zona con bug abierto de imagen de variante).

## Backlog de contenido (no bloquea ninguna HU de sistema)

**Issue #99 — Completar variantes de producto en categorías restantes del catálogo** · Rama `feat/variantes-contenido-categorias` · Kelvin

Completar variantes reales en el seed por categoría (independiente de HU-005/035, que ya funcionan con lo que existe):

| Categoría | Cobertura actual (productos con variantes / 20) |
|---|---|
| Fragancias | 20/20 |
| Maquillaje | 17/20 |
| Vitaminas | 13/20 |
| Suplementos | 12/20 |
| Cuidado personal | 12/20 |
| Fitness | 10/20 |
| Cuidado del bebé | 8/20 |
| Hidratantes | 5/20 |
| Salud de la piel | 4/20 |
| Medicamentos | 0/20 — priorizar antes de HU-032, es el único con forma de variante distinta (dosis/presentación en vez de tamaño/sabor/color) |

---

## Bugs abiertos

_(ninguno pendiente por ahora)_

## Bugs resueltos

- ~~Imagen del item en el carrito no refleja la variante seleccionada~~ — `CartDrawer.tsx` y `Checkout.tsx` llamaban `<ProductImage product={it.product} .../>` sin pasar la imagen de `it.variant`, así que siempre caía al fallback (imagen del producto o variante `isDefault`). Se corrigió pasando `imageUrl={it.variant?.images?.[0] ?? it.variant?.imageUrl}` en ambos. De paso, `Checkout.tsx` también mostraba precio y brand por línea ignorando la variante — corregido a la vez.
