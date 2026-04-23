# Healthora — Farmacia Online

Plataforma de ecommerce para medicamentos OTC y productos de salud. Proyecto académico (Parcial 2 · Soft 9).

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + Vite + TypeScript |
| Backend | Bun + Elysia |
| Base de datos | MongoDB Atlas (Mongoose) |
| Autenticación | Clerk (`@clerk/clerk-react`) |
| Pagos | Stripe |
| Estado global | Zustand + TanStack Query |

## Estructura

```
Healthora/
├── frontend/          # React + Vite (puerto 5175)
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       ├── store/
│       └── lib/api.ts
└── backend/           # Bun + Elysia (puerto 3001)
    └── src/
        ├── routes/
        ├── db/
        │   ├── models/
        │   └── seed.ts
        └── middleware/
```

## Configuración

### Backend — `backend/.env`

```env
MONGODB_URI=mongodb+srv://<user>:<password>@healthora-cluster.2njd5fn.mongodb.net/?appName=Healthora-Cluster
CLERK_SECRET_KEY=sk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### Frontend — `frontend/.env.local`

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:3001
```

## Levantar el proyecto

### 1. Backend

```bash
cd backend
bun install
bun run seed   # poblar MongoDB (solo primera vez)
bun run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend queda en `http://localhost:5175` y hace proxy de `/api/*` al backend en `localhost:3001`.

## API — Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/products` | Listar productos (soporta filtros) |
| GET | `/products/:id` | Detalle de producto |
| GET | `/categories` | Listar categorías |
| POST | `/checkout/session` | Crear sesión de pago Stripe |
| GET | `/orders` | Órdenes del usuario (requiere auth) |
| GET | `/health` | Health check |

### Admin (requiere token de admin Clerk)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/admin/dashboard` | Resumen general |
| GET/PATCH | `/admin/orders` | Gestión de órdenes |
| GET/POST/PUT/DELETE | `/admin/products` | CRUD de productos |
| GET | `/admin/users` | Listar usuarios |
| GET | `/admin/sales` | Reporte de ventas |
| GET | `/admin/earnings` | Reporte de ganancias |

## Seed

El seed carga **12 productos** y **10 categorías** de muestra y borra los datos existentes antes de insertar.

```bash
cd backend && bun run seed
```
