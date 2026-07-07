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
| HU-099 | Completar variantes de producto en categorías restantes del catálogo | `feat/variantes-contenido-categorias` / PR #100 | Kelvin | Variantes (con imágenes) puestas en todos los productos del catálogo que las necesitaban. Maquillaje llega a 20/20; el resto de productos por debajo de ese número son de presentación única y no requieren selector de variante. |
| HU-063 | Validación y saneamiento de inputs con Zod | `HU-063-validacion-y-saneamiento-inputs-zod` / PR #101 | Roy | Zod implementado en rutas de backend: productos, carrito, checkout, órdenes, reseñas, webhooks, admin. |
| HU-085 | Búsqueda simple de productos | `feat/hu-085-busqueda` / PR #102 | EiJassiel | Búsqueda por nombre, marca, categoría, descripción corta y necesidad con escapeRegex. Incluye validación Zod. |
| HU-091 | Migración del frontend a TanStack Start (SSR) | `feat/hu-091-tanstack-start` / PR #103 | Kelvin | Migrado a TanStack Router/Start en modo SPA (sin servidor). Rutas de archivo reales con URLs limpias reemplazan el switch de vistas por `?view=...`. Build y Playwright verificados. |
| HU-065 | Logs de auditoría de seguridad | `HU-065-logs-de-auditoria-de-seguridad` / PR #104 | Roy | Modelo `SecurityAuditLog`, middleware de registro y endpoint admin `/admin/audit-logs`. |
| HU-066 | Logging estructurado | `HU-066-logging-estructurado` / PR #105 | Roy | Logger (pino) + `requestLogger` middleware, reemplaza `console.log` por logs estructurados en `index.ts`. |
| HU-067 | Error tracking con PostHog | `HU-067-error-tracking-con-posthog` / PR #107 | Roy | Captura de excepciones (backend y frontend), `ErrorBoundary`, reporte de errores vía PostHog + endpoint admin. Mergeado resolviendo conflicto con HU-065/066 en `backend/src/index.ts` y `package.json`/`bun.lock` (ambas features tocan el bootstrap del servidor). |
| HU-068 | APM y métricas de rendimiento | `HU-068-apm-y-metricas-de-rendimiento` / PR #108 | Roy | Middleware de métricas de performance + endpoint admin `/admin/performance`. |
| HU-083 | Páginas de error (404, 500) | `feat/hu-083-errores` / merge directo a `main` (`ae755a9`) | EiJassiel | `ErrorPage`, `NotFoundView`, `RouteErrorView` y `ErrorBoundary` integrados con TanStack Router. |
| HU-086 | Documentación API (OpenAPI/Swagger) | `feat/hu-086-openapi` / merge directo a `main` (`36b7465`) | EiJassiel | Spec en `/openapi.json` y Swagger UI en `/docs` (solo backend). |
| HU-087 | Refactor del componente admin monolítico | `feat/hu-087-refactor-admin` / merge directo a `main` (`118e928`) | EiJassiel | `AdminApp` dividido en secciones, hooks y componentes; conserva paneles de rendimiento y errores (HU-068/067). |
| HU-082 | Accesibilidad (WCAG 2.1 AA) | `feat/hu-082-accesibilidad` / merge directo a `main` (`015c27c`) | EiJassiel | Skip link, landmarks, `:focus-visible`, modales con focus trap, labels ARIA y `e2e/a11y.spec.ts`. |
| HU-076 | Estrategia de rollback | `feat/hu-076-rollback` / merge directo a `main` (`9d39d30`) | EiJassiel | `docs/rollback-strategy.md`, `tooling/ops/health-check.ps1`, `tag-release.ps1`. |
| HU-075 | Entorno staging | `feat/hu-075-staging` / merge directo a `main` | EiJassiel | `APP_ENV`, `CORS_ORIGINS`, `.env.staging.example` y `docs/staging-environment.md`. |
| HU-078 | CDN Cloudinary imágenes | `feat/hu-078-cloudinary-cdn` / merge directo a `main` | EiJassiel | `frontend/src/lib/cloudinary.ts` + `ProductImage` con fetch transform y lazy load. |
| HU-074 | Backups MongoDB Atlas | `feat/hu-074-backups-mongodb` / merge directo a `main` | EiJassiel | `docs/mongodb-backups.md` + `tooling/ops/mongodb-backup.ps1`. |
| HU-077 | Cache Redis catálogo | `feat/hu-077-cache-redis` / merge directo a `main` | EiJassiel | `backend/src/lib/cache.ts` (Redis o memoria), productos y categorías cacheados. |
| HU-073 | Containerización y CI/CD | `feat/hu-073-containerizacion-cicd` / merge directo a `main` | EiJassiel | `docker-compose.yml`, CI GitHub Actions, Dockerfile puerto 3002, docs. |

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
| 7 | HU-069 | Alertas y monitoreo de uptime |

HU-065/066/067/068 ya mergeadas a `main` (ver tabla de Completadas), fuera de orden respecto al plan original (Roy las abrió antes que 062/064) — 062 y 064 siguen pendientes.

En pausa hasta que variantes/UI se estabilicen: HU-070/071/072 (tests), HU-080/081 (optimización de imágenes / HTTP cache — tocan `ProductCard`/`ProductImage`, zona con bug abierto de imagen de variante).

---

## Bugs abiertos

_(ninguno pendiente por ahora)_

## Bugs resueltos

- ~~Imagen del item en el carrito no refleja la variante seleccionada~~ — `CartDrawer.tsx` y `Checkout.tsx` llamaban `<ProductImage product={it.product} .../>` sin pasar la imagen de `it.variant`, así que siempre caía al fallback (imagen del producto o variante `isDefault`). Se corrigió pasando `imageUrl={it.variant?.images?.[0] ?? it.variant?.imageUrl}` en ambos. De paso, `Checkout.tsx` también mostraba precio y brand por línea ignorando la variante — corregido a la vez.
- ~~Orden no se crea ni llega email tras pago exitoso de Stripe~~ (Issue #106, PR #109) — tras la migración a TanStack Start (HU-091) las rutas pasaron de `?view=...` a paths reales (`/checkout`, `/success`), pero `success_url`/`cancel_url` en `backend/src/routes/checkout.ts` seguían apuntando a `${origin}/?view=success...`. El router nuevo ignora `view` en `/` y renderiza Landing, así que el componente `Success` (crea la orden de respaldo si el webhook no llegó, manda el correo, limpia el carrito) nunca se montaba. Se corrigió apuntando a `/success` y `/checkout`. De paso se arregló que `GET /orders?stripeSessionId=` devolvía 200 con `{error}` en vez de 404 cuando la orden de respaldo aún no existía, así que el retry de `react-query` nunca se activaba.
