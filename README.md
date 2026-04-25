# Healthora

Ecommerce academico enfocado en salud, cuidado personal, bebe, skincare, fitness y medicamentos OTC.

## Stack

| Capa | Tecnologia |
|------|------------|
| Frontend | React 19 + Vite + TypeScript |
| Backend | Bun + Hono |
| Base de datos | MongoDB Atlas + Mongoose |
| Auth | Clerk |
| Pagos | Stripe |
| Estado y data | Zustand + TanStack Query |

## Estado Actual

- Catalogo real con `90` productos y `10` categorias.
- Cada producto tiene `4` imagenes reales en `frontend/public/products/`.
- Carrito persistente por usuario con sincronizacion cross-device via backend.
- Panel admin protegido con Clerk + rol `admin`.
- Dashboard admin conectado a datos reales de ordenes, ventas, ganancias, usuarios y stock.
- Checkout con direccion obligatoria.
- Las ordenes solo se crean cuando Stripe confirma el pago por webhook.
- El catalogo conserva categoria y pagina al entrar a detalle y volver atras.

## Estructura

```text
Healthora/
|-- frontend/
|   |-- public/products/
|   |-- src/
|   |-- package.json
|   `-- bun.lock
|-- backend/
|   |-- src/
|   |   |-- db/
|   |   |-- middleware/
|   |   `-- routes/
|   |-- package.json
|   `-- bun.lock
|-- README.md
`-- CONTEXT.md
```

## Package Manager

Este repo tiene `bun.lock` en `frontend/` y `backend/` porque son dos apps separadas con dependencias distintas.

En la practica real:

- Se usa un solo package manager por paquete.
- Si una app usa Bun, se versiona su `bun.lock`.
- No conviene mezclar `npm install` y `bun install` dentro de la misma carpeta.

En este proyecto, la forma recomendada es usar Bun tanto en frontend como en backend.

## Variables de entorno

### Backend - `backend/.env`

```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/healthora
CLERK_SECRET_KEY=sk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PORT=3001
FRONTEND_URL=http://localhost:5173
ADMIN_EMAILS=tu-correo@dominio.com
```

### Frontend - `frontend/.env.local`

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:3001
```

## Levantar el proyecto

### 1. Backend

```bash
cd backend
bun install
bun run seed
bun run dev
```

### 2. Frontend

```bash
cd frontend
bun install
bun run dev
```

## URLs locales

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

## Endpoints Principales

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/products` | Lista productos con filtros |
| GET | `/products/:id` | Devuelve detalle de producto |
| GET | `/categories` | Lista categorias |
| GET | `/health` | Health check |
| GET/PUT | `/cart` | Lee y persiste el carrito del usuario |
| POST | `/checkout/session` | Crea sesion de pago Stripe |
| GET | `/orders` | Lista ordenes del usuario autenticado |

### Admin

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/admin/access` | Valida acceso admin |
| GET | `/admin/dashboard` | KPIs, ventas, ordenes recientes y stock bajo |
| GET/PATCH | `/admin/orders` | Gestion de fulfillment |
| GET/POST/PUT/DELETE | `/admin/products` | CRUD de productos |
| GET | `/admin/users` | Lista de usuarios |
| PATCH | `/admin/users/:id/role` | Cambia rol |
| DELETE | `/admin/users/:id` | Elimina usuario local |
| GET | `/admin/sales` | Top productos, categorias y marcas |
| GET | `/admin/earnings` | Revenue bruto/neto mensual |

## Seed e imagenes

- El seed carga `90` productos y `10` categorias.
- Las imagenes viven en `frontend/public/products/`.
- La convencion de archivos es `/products/<categoria>/<product-id>-1.jpg` hasta `-4.jpg`.
- Archivos de referencia disponibles:
  - `product-image-manifest.md`
  - `product-image-download-report.json`

## Admin

- El acceso admin depende de `ADMIN_EMAILS` o del rol `admin` almacenado para el usuario.
- Si cambias `ADMIN_EMAILS`, reinicia backend y vuelve a iniciar sesion.

## Checkout y ordenes

- El checkout exige direccion completa.
- Stripe test card valida: `4242 4242 4242 4242`
- Stripe test card rechazada: `4000 0000 0000 0002`
- Las ordenes solo se crean en `checkout.session.completed`.

## Archivos locales que no se versionan

- `.env*`
- `.agents/`, `.claude/`, `.playwright-mcp/`
- `skills-lock.json`
- `scripts/`
- `tmp/`

Los archivos dentro de `scripts/` se tratan como tooling local. Si alguna vez estuvieron trackeados por Git, hay que quitarlos del index para que `.gitignore` pueda hacer efecto.
