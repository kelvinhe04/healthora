# Contexto Healthora

## Resumen

Healthora es un ecommerce academico enfocado en productos de salud, cuidado personal, bebe, skincare, fitness y medicamentos OTC.

## Tecnologias

- Frontend: React 19 + Vite + TypeScript
- Backend: Bun + Hono
- Base de datos: MongoDB Atlas con Mongoose
- Autenticacion: Clerk
- Pagos: Stripe
- Estado y datos: Zustand + TanStack Query

## Estructura

- `frontend/`: aplicacion cliente en React
- `backend/`: API, autenticacion, checkout, modelos y seed
- `README.md`: configuracion general y reglas operativas del repo
- `package.json` en raiz: scripts de conveniencia para levantar frontend y backend

## Configuracion actual

- Frontend local: `http://localhost:5173`
- Backend local: `http://localhost:3001`
- Comando de seed: `cd backend && bun run seed`
- Inicializacion de admin: `ADMIN_EMAILS` en `backend/.env`
- Gestor de paquetes recomendado: Bun en raiz, `frontend/` y `backend/`
- Archivos de lock esperados: `bun.lock`, `frontend/bun.lock` y `backend/bun.lock`

## Notas importantes

- No se deben subir secretos ni archivos de entorno reales.
- Tampoco se deben subir carpetas locales de herramientas como `.agents`, `.claude` o `.playwright-mcp`.
- `skills-lock.json` se trata como estado local de herramientas, no como archivo del producto.
- `scripts/` se trata como herramientas locales y no debe versionarse.
- Si se cambia `ADMIN_EMAILS`, hay que reiniciar backend y volver a iniciar sesion.
- Las ordenes se crean solo cuando Stripe confirma pago (webhook `checkout.session.completed`).
- Las ordenes pueden reaparecer si existen sesiones pagadas en Stripe; el sistema las recrea automaticamente.

## Trabajo reciente

### Backend
- Migracion completa de Elysia a Hono
- Autenticacion con Clerk usando `verifyToken`
- Webhook de Stripe que crea ordenes solo cuando el pago es exitoso
- Carrito persistente por usuario con sincronizacion entre dispositivos
- Separacion de estados: `paymentStatus` (paid/pending/cancelled/refunded) vs `fulfillmentStatus` (unfulfilled/processing/shipped/delivered)
- Eliminacion de duplicados de usuarios en MongoDB
- Ajustes de Mongoose: `new: true` -> `returnDocument: 'after'`
- Ruta de ventas con productos, categorias y marcas destacadas agrupadas

### Frontend
- Catalogo real con 200 productos y 10 categorias
- 4 imagenes reales por producto servidas desde `frontend/public/products/`
- Checkout con campos de direccion obligatorios
- Panel admin con:
  - Dashboard con metricas reales
  - Pedidos: cambio de estado de envio con selector
  - Productos: CRUD, eliminacion masiva y filtros por categoria
  - Usuarios: cambio de rol y eliminacion local
  - Ventas: tendencia diaria, top productos, top categorias y top marcas
- Ganancias: ingreso bruto/neto y detalle mensual
- Catalogo con busqueda de marcas y boton para limpiar
- Carrito persistente
- Navegacion del catalogo conserva filtro y pagina al volver desde detalle

## Caracteristicas clave

- Las ordenes solo se crean despues de pago confirmado en Stripe
- El usuario admin se asigna por email en `ADMIN_EMAILS` del `.env`
- El panel admin es accesible para usuarios con `role: admin` en Mongo o `ADMIN_EMAILS`
- Las categorias y marcas en ventas se agrupan y suman unidades e ingreso
- El carrito se sincroniza entre dispositivos a traves del backend

## Pruebas

- Tarjeta de prueba de Stripe: `4242 4242 4242 4242`
- Tarjeta rechazada de prueba: `4000 0000 0000 0002`
- URLs autorizadas en Clerk: `http://localhost:5173`, `http://localhost:5175`, `http://localhost:3001`
