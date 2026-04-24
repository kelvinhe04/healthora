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

## Estado Actual

- Catálogo real con `90` productos y `10` categorías.
- Cada producto tiene `4` imágenes reales organizadas por categoría en `frontend/public/products/`.
- Carrito persistente por usuario con sincronización cross-device vía backend.
- Panel admin funcional con acceso protegido por Clerk + rol `admin`.
- Dashboard admin conectado a datos reales de órdenes, ventas, ganancias, usuarios y stock.

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
FRONTEND_URL=http://localhost:5175
ADMIN_EMAILS=tu-correo-admin@dominio.com
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
| GET/PUT | `/cart` | Leer y persistir carrito del usuario |
| POST | `/checkout/session` | Crear sesión de pago Stripe |
| GET | `/orders` | Órdenes del usuario (requiere auth) |
| GET | `/health` | Health check |

### Admin (requiere token de admin Clerk)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/admin/access` | Validar acceso admin y rol actual |
| GET | `/admin/dashboard` | Resumen general |
| GET/PATCH | `/admin/orders` | Gestión de órdenes |
| GET/POST/PUT/DELETE | `/admin/products` | CRUD de productos |
| GET | `/admin/users` | Listar usuarios |
| PATCH | `/admin/users/:id/role` | Cambiar rol local y sincronizar con Clerk |
| GET | `/admin/sales` | Reporte de ventas |
| GET | `/admin/earnings` | Reporte de ganancias |

## Seed

El seed actual carga **90 productos** y **10 categorías** con marcas reales y borra los datos existentes antes de insertar.

```bash
cd backend
bun run seed
```

## Imagenes De Productos

Las imagenes no se sirven desde el backend. Se cargan directamente desde el frontend usando archivos estaticos.

Ruta base:

- `frontend/public/products/`

Convencion usada por el seed:

- `imageUrl: /products/<category-folder>/<id>-1.jpg`
- `images: /products/<category-folder>/<id>-1.jpg ... /products/<category-folder>/<id>-4.jpg`

Ejemplo:

- producto con `id: cerave-moisturizing-cream`
- carpeta de categoria: `hidratantes`
- archivos esperados:
  - `frontend/public/products/hidratantes/cerave-moisturizing-cream-1.jpg`
  - `frontend/public/products/hidratantes/cerave-moisturizing-cream-2.jpg`
  - `frontend/public/products/hidratantes/cerave-moisturizing-cream-3.jpg`
  - `frontend/public/products/hidratantes/cerave-moisturizing-cream-4.jpg`
- URL publica principal en la app: `/products/hidratantes/cerave-moisturizing-cream-1.jpg`

Si una imagen todavia no existe, la app sigue funcionando y muestra el mock visual del producto.

Consulta la convencion y los archivos descargados en:

- `product-image-manifest.md`
- `product-image-download-report.json`

## Carrito Persistente

- Invitado: carrito local vacío al cerrar sesión.
- Usuario autenticado: carrito persistido en backend y sincronizado entre navegadores/dispositivos.
- Después de una compra exitosa en Stripe, el carrito local y remoto se vacían automáticamente.

## Acceso Admin

- El acceso al panel admin ya no aparece como botón público en el navbar.
- El entrypoint está dentro del menú del usuario autenticado.
- El backend decide si una cuenta es admin por:
  - `ADMIN_EMAILS` en `backend/.env`
  - o `publicMetadata.role = admin` en Clerk
- Si agregas un correo a `ADMIN_EMAILS`, reinicia el backend y vuelve a iniciar sesión para que tome efecto.
