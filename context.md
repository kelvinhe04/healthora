# Healthora Context

## Overview

Healthora es un ecommerce académico enfocado en productos de salud, cuidado personal, bebé, skincare, fitness y medicamentos OTC.

## Stack

- Frontend: React 19 + Vite + TypeScript
- Backend: Bun + Elysia
- Database: MongoDB Atlas con Mongoose
- Auth: Clerk
- Payments: Stripe
- State/Data: Zustand + TanStack Query

## Structure

- `frontend/`: aplicación cliente en React
- `backend/`: API, autenticación, checkout, modelos y seed
- `README.md`: setup general del proyecto

## Current Setup

- Frontend local: `http://localhost:5175`
- Backend local: `http://localhost:3001`
- Seed command: `cd backend && bun run seed`
- Admin bootstrap: `ADMIN_EMAILS` en `backend/.env`

## Important Notes

- No se deben subir secretos ni archivos de entorno reales.
- Tampoco se deben subir carpetas locales de tooling como `.agents`, `.claude` o `.playwright-mcp`.
- `skills-lock.json` se trata como estado local de herramientas, no como archivo del producto.
- Si se cambia `ADMIN_EMAILS`, hay que reiniciar backend y volver a iniciar sesión.

## Recent Work

- Se corrigió la autenticación con Clerk en backend usando `verifyToken`.
- Se ajustó el checkout para usar el `origin` real de la request.
- Se añadió avatar y menú de usuario en el header.
- Se reemplazó el seed viejo por un catálogo real de `90` productos y `10` categorías.
- Se añadieron `4` imágenes por producto, organizadas por carpeta de categoría en frontend.
- Se cambió el render de imágenes reales a fondo blanco para mejor consistencia visual.
- Se implementó carrito persistente por usuario con sincronización cross-device en backend.
- Se corrigió el vaciado del carrito tras una compra exitosa en Stripe.
- Se volvió funcional el panel admin con métricas reales, edición de órdenes/productos y gestión de roles.
- Se protegió el acceso admin con Clerk y bootstrap por `ADMIN_EMAILS`.
