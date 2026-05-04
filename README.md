# Healthora

E-commerce académico de farmacia y salud. Catálogo real de 200 productos en 10 categorías, carrito persistente multi-dispositivo, checkout con Stripe y panel de administración completo.

> Para la arquitectura detallada con diagramas, ver [`docs/arquitectura.md`](docs/arquitectura.md).

---

## Tecnologías

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | React + Vite + TypeScript | 19 / 8 / 6 |
| Backend | Hono + Bun | 4.12 / latest |
| Base de datos | MongoDB Atlas + Mongoose | Atlas / 9.5 |
| Autenticación | Clerk | 5.61 (FE) / 3.3 (BE) |
| Pagos | Stripe | 22.0 |
| Estado cliente | Zustand | 5.0 |
| Estado servidor | TanStack Query | 5.100 |
| Gráficas | Recharts | 3.8 |
| Emails | nodemailer (SMTP) | 7.0 |

---

## Estado del Proyecto

- Catálogo con `200` productos reales y `10` categorías.
- `4` imágenes reales por producto en `frontend/public/products/<categoria>/`.
- Carrito persistente por usuario, sincronizado entre dispositivos vía backend.
- Checkout con dirección obligatoria, cálculo de impuesto (7%) y envío ($6.90, gratis sobre $50).
- Órdenes creadas exclusivamente al confirmar pago por webhook de Stripe.
- Panel admin protegido: CRUD de productos, gestión de órdenes y usuarios, métricas reales.
- Dashboard admin con KPIs en tiempo real, ventas diarias (30 días consecutivos), productos con stock bajo.
- Catálogo conserva categoría, página y filtros al volver desde detalle de producto.
- Roles `customer` y `admin` gestionados por Clerk + MongoDB.
- Reseñas de productos con rating y comentarios.
- Diseño responsive adaptado a tablet y teléfono mediante breakpoints (`mobile`, `tablet`, `desktop`) con hook `useBreakpoint`.
- Modo oscuro (dark mode) con transición animada de 400ms.
- Emails de confirmación de pedido con nodemailer (SMTP Gmail).

---

## Estructura del Repositorio

```text
Healthora/
├── backend/
│   ├── src/
│   │   ├── index.ts               ← Entry point Hono
│   │   ├── db/
│   │   │   ├── connection.ts
│   │   │   ├── models/            ← Product, Order, User, Category, Review
│   │   │   ├── seed.ts          ← 200 productos + 10 categorías
│   │   │   ├── seed-orders.ts   ← Órdenes de ejemplo
│   │   │   └── seed-reviews.ts  ← Reseñas de ejemplo
│   │   ├── middleware/
│   │   │   ├── clerkAuth.ts      ← Verifica JWT + upsert usuario
│   │   │   └── requireAdmin.ts   ← Bloquea si rol !== 'admin'
│   │   ├── routes/
│   │   │   ├── products.ts
│   │   │   ├── categories.ts
│   │   │   ├── cart.ts
│   │   │   ├── checkout.ts
│   │   │   ├── orders.ts
│   │   │   ├── account.ts
│   │   │   ├── webhooks.ts
│   │   │   ├── newsletter.ts
│   │   │   ├── reviews.ts
│   │   │   └── admin/
│   │   │       ├── adminAccess.ts
│   │   │       ├── adminDashboard.ts
│   │   │       ├── adminOrders.ts
│   │   │       ├── adminProducts.ts
│   │   │       ├── adminUsers.ts
│   │   │       ├── adminSales.ts
│   │   │       └── adminEarnings.ts
│   │   ├── lib/
│   │   │   ├── clerk.ts         ← SDK de Clerk
│   │   │   ├── stripe.ts        ← SDK de Stripe
│   │   │   ├── email.ts        ← nodemailer (SMTP)
│   │   │   ├── orderStatus.ts  ← Utilidad de normalización
│   │   │   └── promotions.ts ← Promociones activas
│   │   ├── test-email.ts       ← Script de prueba de SMTP
│   │   └── types/
│   │       ├── hono.ts
│   │       └── index.ts
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── public/products/           ← Imágenes por categoría (4 por producto)
│   ├── src/
│   │   ├── main.tsx           ← ClerkProvider + QueryClientProvider
│   │   ├── App.tsx           ← Router + cart sync lifecycle
│   │   ├── components/
│   │   │   ├── chrome/       ← Header, Footer, Topbar, SignInModal
│   │   │   ├── shared/      ← ProductCard, Stars, Button, Icon, ReviewSection
│   │   │   └── admin/      ← UI del panel de administración
│   │   ├── pages/
│   │   │   ├── Landing.tsx       ← Home con productos destacados
│   │   │   ├── Catalog.tsx       ← Grid de productos con filtros
│   │   │   ├── ProductDetail.tsx ← Vista detalle + reseñas
│   │   │   ├── CartDrawer.tsx    ← Carrito lateral
│   │   │   ├── Checkout.tsx      ← Formulario + pago Stripe
│   │   │   ├── Success.tsx       ← Confirmación de orden
│   │   │   ├── Orders.tsx        ← Historial de órdenes
│   │   │   ├── Club.tsx         ← Página de membresía
│   │   │   └── admin/AdminApp.tsx
│   │   ├── hooks/
│   │   │   ├── useProducts.ts
│   │   │   ├── useCategories.ts
│   │   │   ├── useOrders.ts
│   │   │   └── useReviews.ts
│   │   ├── store/cartStore.ts  ← Zustand (guest vs auth)
│   │   ├── lib/api.ts      ← Cliente HTTP centralizado
│   │   ├── types/index.ts
│   │   └── promotions.ts
│   ├── .env.example
│   └── package.json
│
├── docs/
│   └── arquitectura.md          ← Diagramas, flujos, esquemas BD
├── package.json                ← Scripts raíz (concurrently)
└── README.md
```

---

## Gestor de Paquetes

Este repo usa **Bun** en los tres niveles: raíz, `frontend/` y `backend/`. Cada uno tiene su propio `bun.lock`. No mezclar con `npm install`.

---

## Variables de Entorno

Copiar los `.env.example` antes de levantar el proyecto.

### Backend — `backend/.env`

```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/healthora
MONGODB_DB_NAME=healthora
CLERK_SECRET_KEY=sk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PORT=3001
FRONTEND_URL=http://localhost:5173
CLERK_JWT_KEY=
ADMIN_EMAILS=tu-correo@dominio.com

# SMTP (nodemailer) - opcional
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-gmail@gmail.com
SMTP_PASS=contraseña-de-app-de-16-caracteres
SMTP_FROM=Healthora <noreply@healthora.com>
```

> `ADMIN_EMAILS` puede tener varios emails separados por coma. Al iniciar sesión con uno de esos emails, el middleware le asigna automáticamente `role: 'admin'` en MongoDB.

### Frontend — `frontend/.env`

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:3001
```

> En desarrollo, el proxy de Vite redirige `/api/*` → `http://localhost:3001/*`, por lo que `VITE_API_URL` solo importa en producción.

---

## Levantar el Proyecto

### Opción A — Desde la raíz (recomendado)

```bash
bun install
bun run dev       # levanta frontend (:5173) y backend (:3001) en paralelo
```

### Opción B — Por separado

```bash
# Terminal 1
cd backend && bun install && bun run dev

# Terminal 2
cd frontend && bun install && bun run dev
```

### Primera vez: sembrar la base de datos

```bash
cd backend
bun run seed           # carga 200 productos + 10 categorías
bun run seed-orders    # (opcional) carga órdenes de ejemplo
bun run seed-reviews  # (opcional) carga reseñas de ejemplo
```

### Webhook de Stripe en local

```bash
# Requiere Stripe CLI instalado y autenticado
stripe listen --forward-to http://localhost:3001/webhooks/stripe
# Copiar el whsec_... que imprime y pegarlo en STRIPE_WEBHOOK_SECRET
```

---

## URLs Locales

| Servicio | URL |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend | `http://localhost:3001` |
| Health check | `http://localhost:3001/health` |

---

## Endpoints del Backend

### Públicos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado del servidor |
| GET | `/products` | Lista productos (filtros: `category`, `need`, `brand`, `priceMax`, `sort`, `inStock`, `search`) |
| GET | `/products/:id` | Detalle de producto |
| GET | `/categories` | Lista categorías |

### Autenticados (requieren JWT de Clerk)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/cart` | Carrito del usuario (con productos hidratados) |
| PUT | `/cart` | Guardar items del carrito |
| POST | `/checkout/session` | Crear sesión de pago Stripe → devuelve `{ url }` |
| GET | `/orders` | Órdenes del usuario (soporta `?stripeSessionId=`) |
| GET | `/orders/:id` | Detalle de orden |
| GET | `/account/addresses` | Direcciones guardadas |
| PUT | `/account/addresses` | Guardar direcciones |

### Reseñas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/reviews/:productId` | Reseñas de un producto |
| POST | `/reviews/:productId` | Crear reseña |
| DELETE | `/reviews/:reviewId` | Eliminar reseña (solo autor o admin) |

### Webhook

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/webhooks/stripe` | Recibe `checkout.session.completed` → crea orden + descuenta stock |

### Public Newsletter

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/newsletter/subscribe` | Suscribir email al newsletter |

### Admin (JWT + `role: admin`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/admin/access` | Valida acceso admin |
| GET | `/admin/dashboard` | KPIs, ventas diarias (30 días), órdenes recientes, stock bajo |
| GET | `/admin/orders` | Lista órdenes (filtro `?fulfillmentStatus=`) |
| PATCH | `/admin/orders/:id/statuses` | Actualiza `paymentStatus` y/o `fulfillmentStatus` |
| GET | `/admin/products` | Lista todos los productos |
| POST | `/admin/products` | Crear producto |
| PUT | `/admin/products/:id` | Actualizar producto |
| DELETE | `/admin/products/:id` | Eliminar producto |
| GET | `/admin/users` | Lista usuarios |
| PATCH | `/admin/users/:id/role` | Cambiar rol (`customer` ↔ `admin`) |
| DELETE | `/admin/users/:id` | Eliminar usuario |
| GET | `/admin/sales` | Top productos, marcas y categorías por ingreso |
| GET | `/admin/earnings` | Desglose mensual de ingresos brutos y netos |

---

## Imágenes y Seed

- Convención de archivos: `frontend/public/products/<categoria>/<product-id>-1.jpg` … `-4.jpg`
- El seed lee los productos desde `src/db/seed.ts` y hace upsert en MongoDB.
- Si se re-ejecuta `bun run seed`, actualiza sin duplicar (usa `updateOne` con `upsert: true`).

---

## Checkout y Órdenes

- Dirección completa es obligatoria antes de pagar.
- El backend crea la sesión de Stripe con todos los metadatos (items, dirección, impuesto, envío).
- La orden en MongoDB **solo se crea en el webhook** (`checkout.session.completed`), nunca antes.
- El frontend sondea `GET /orders?stripeSessionId=...` tras el redirect de Stripe para mostrar la confirmación.

**Tarjetas de prueba Stripe:**

| Número | Resultado |
|---|---|
| `4242 4242 4242 4242` | Pago aprobado |
| `4000 0000 0000 0002` | Pago rechazado |

---

## Zonas Horarias

- **Frontend**: Todas las fechas se muestran en `America/Panama`.
- **Stripe**: Configurar en Settings → Account details → Timezone: `America/Panama`.

---

## Admin

- Acceso por `ADMIN_EMAILS` en `.env` o por `role: 'admin'` guardado en MongoDB.
- Si se modifica `ADMIN_EMAILS`, reiniciar el backend y volver a iniciar sesión.
- El frontend valida el acceso llamando `GET /admin/access` antes de renderizar el panel.

---

## Emails de Confirmación

El sistema envía un email de confirmación al cliente después de cada compra exitosa usando **nodemailer** con SMTP.

### Configuración de Gmail SMTP

1. **Crear o usar una cuenta de Gmail** (ej: `healthora24@gmail.com`)

2. **Activar verificación en 2 pasos**:
   - Ve a https://myaccount.google.com/security
   - Activa "Verificación en 2 pasos"

3. **Generar contraseña de aplicación**:
   - Ve a https://myaccount.google.com/security
   - Busca "Contraseñas de aplicaciones" (al final de la página)
   - Selecciona: App = "Correo", Dispositivo = "Otro (especificar)"
   - Te dará una contraseña de 16 caracteres

4. **Configurar en `backend/.env`**:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=tu-gmail@gmail.com
   SMTP_PASS=la-contraseña-de-16-caracteres
   SMTP_FROM=Healthora <noreply@healthora.com>
   ```

### Emails enviados

- Confirmación de Pedido (al completar compra)
- Actualización de estado de orden (cuando cambia fulfillmentStatus)
- Suscripción al Newsletter

---

## Archivos No Versionados

```gitignore
.env*
!.env.example
!.env.*.example
.agents/
.claude/
.playwright-mcp/
skills-lock.json
scripts/
tmp/
dist/
node_modules/
```

Los reportes temporales, scripts locales de utilidad y herramientas de agentes no se versionen aunque estén en el árbol local.