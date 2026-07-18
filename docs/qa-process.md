# Proceso de QA

Registro de cómo se prueba Healthora en cada capa, y checklist de regresión para correr antes de una demo o entrega.

---

## Capas de prueba

| Capa | Herramienta | Qué cubre | Dónde |
|---|---|---|---|
| Unitarios | `bun test` (Bun) | Lógica de negocio pura: precios/descuentos por variante, ITBMS, stock, tracking, cohortes, etc. | `backend/src/lib/*.test.ts` |
| Integración | `bun test` (Bun) | Rutas Hono contra Mongo real (test DB), flujos completos (pago, devoluciones, moderación de reseñas, MCP). | `backend/src/**/*.integration.test.ts`, `backend/src/tests/*.integration.test.ts` |
| End-to-end | Playwright | Navegador real contra la app corriendo (frontend + backend), cubriendo storefront y panel admin. | `frontend/e2e/*.spec.ts` |

Los tres corren en CI (`.github/workflows/ci.yml`, jobs `backend`, `frontend`, `e2e`) en cada push/PR a `main`. El job `e2e` requiere secrets de un entorno de prueba (ver sección siguiente) — sin ellos, ese job falla al no poder levantar el backend.

### Secrets requeridos para el job `e2e`

Configurar en GitHub → Settings → Secrets and variables → Actions, con credenciales de un cluster/proyecto de **prueba** (nunca producción):

- `MONGODB_URI` — cluster Atlas de test
- `CLERK_SECRET_KEY` — clave de test
- `STRIPE_SECRET_KEY` — clave de test
- `VITE_STRIPE_PUBLISHABLE_KEY` — clave pública de test (no sensible, pero no está como variable de repo)
- `MCP_SERVICE_TOKEN` — cualquier valor random (`openssl rand -hex 32`)

`VITE_CLERK_PUBLISHABLE_KEY` ya existe como variable del repo (no secret).

---

## Bypass de autenticación en e2e

Los tests de Playwright no inician sesión real contra Clerk (headless, sin flujo interactivo). En su lugar, `frontend/src/lib/e2eAuth.ts` expone dos flags de `localStorage`, activados solo por los tests vía `page.addInitScript`:

- `healthora-e2e-auth` — simula un cliente autenticado (usado en checkout, carrito, wishlist, pedidos, perfil).
- `healthora-e2e-admin` — simula un admin con rol `owner` sin pasar por `GET /admin/access` (usado en todos los specs `admin-*`).

Ningún llamador real (usuario de producción) puede activar estos flags de forma útil: solo cambian el estado del cliente, y cualquier request real a la API sigue exigiendo un token válido de Clerk — los tests que los usan mockean esas rutas con `page.route`.

`Orders.tsx`/`hooks/useOrders.ts` y `Profile.tsx` usaban `useAuth()`/`useUser()` de Clerk directo, sin este bypass — se unificaron sobre un nuevo hook compartido, `hooks/useEffectiveToken.ts` (envuelve `getToken` de Clerk, cae al token falso de e2e si el flag está activo), en vez de repetir el patrón inline de `Checkout.tsx` en cada uno de los ~9 call sites que tenían entre los dos archivos.

---

## Checklist de regresión pre-demo

Correr `bun run test:e2e` (desde `frontend/`) y confirmar verde. Cubre, con datos mockeados y deterministas:

**Storefront**
- [ ] Catálogo: listado, filtro por categoría, ficha de producto (`catalog.spec.ts`)
- [ ] Carrito: agregar producto, contador (`cart-and-theme.spec.ts`)
- [ ] Modo oscuro, newsletter (`cart-and-theme.spec.ts`)
- [ ] Accesibilidad: skip link, landmark único, nav con `href`, diálogo del carrito, estado de variantes (`a11y.spec.ts`)
- [ ] Checkout: dirección completa, pago con Stripe Elements, cupón de descuento, error de sesión de pago (`checkout.spec.ts`)
- [ ] Wishlist: agregar desde catálogo, estado vacío (`wishlist-compare.spec.ts`)
- [ ] Comparador: agregar productos (`wishlist-compare.spec.ts`)
- [ ] Reseñas de producto: filtro por estrellas, prompt de inicio de sesión (`product-reviews.spec.ts`)
- [ ] Club Healthora: beneficios y CTA (`club.spec.ts`)
- [ ] Pedidos: listado, solicitar devolución sobre un pedido entregado (`orders-returns.spec.ts`)
- [ ] Perfil: datos de cuenta, suscripciones, métodos de pago (`profile.spec.ts`)

**Panel admin**
- [ ] Dashboard: KPIs, navegación entre secciones (`admin-dashboard.spec.ts`)
- [ ] Catálogo: búsqueda, eliminar producto, crear categoría (`admin-catalog.spec.ts`)
- [ ] Pedidos: búsqueda, avanzar estado de envío (`admin-orders.spec.ts`)
- [ ] Clientes: búsqueda, promover a admin (`admin-users.spec.ts`)
- [ ] Cupones: crear, eliminar (`admin-coupons.spec.ts`)
- [ ] Devoluciones: listado, aprobar solicitud (`admin-returns.spec.ts`)
- [ ] Reseñas: ocultar, banear autor (`admin-reviews.spec.ts`)

**Fuera de este checklist automatizado** (verificar a mano antes de la demo):
- Edición de nombre/foto de perfil (delega en el modal nativo de Clerk, `openUserProfile()` — no es código propio).
- Notificaciones en tiempo real vía WebSocket (requiere dos sesiones simultáneas).
- MCP: correr `backend/src/mcp/mcp.integration.test.ts` (ya cubierto en el job `backend` de CI) y, si se quiere verificar contra un cliente real, conectar Claude Code/Codex al endpoint `/mcp` siguiendo `docs/mcp-server.md`.

---

## Bugs encontrados y corregidos durante esta sesión de QA

Quedan documentados aquí porque no eran evidentes sin correr el suite completo (nunca se había corrido en CI):

- `frontend/playwright.config.ts` no fijaba `locale`, así que en cualquier entorno con locale del navegador distinto a español (típico en CI) todo el suite fallaba con selectors en español apuntando a una UI en inglés.
- `checkout.spec.ts` probaba un flujo de checkout con redirect a Stripe Checkout hospedado (`POST /checkout/session`) que ya no existe en el código — el checkout real usa Stripe Elements embebido (`POST /checkout/payment-intent` + `confirmCardPayment`). El test pasaba "por accidente" (fallaba antes de llegar al punto que realmente verificaba) hasta que se lo revisó a fondo.
- `CartDrawer.tsx`: el diálogo del carrito (`role="dialog" aria-modal="true"`) seguía en el árbol de accesibilidad y alcanzable por teclado aun cerrado (solo se movía fuera de pantalla con `transform`) — corregido con `inert`/`aria-hidden` condicionales.
- `Header.tsx`: los links de navegación de anclas (`Categorías`, `Más vendidos`, etc.) no tenían `href`, por lo que no eran expuestos como `role="link"` para lectores de pantalla ni abribles en pestaña nueva — corregido agregando `href="/#anchor"` con `preventDefault()` en el `onClick`.
- `a11y.spec.ts` probaba contra rutas `?view=...` de un esquema de routing anterior a la migración a TanStack Router (HU-091) — nunca llegaba a la página real que decía probar.
