# Otorgar acceso admin/owner en producción

Ver issue: "Sin acceso admin/owner en la página de producción" (healthora-shop.vercel.app).

## Causa raíz

El rol de un usuario se resuelve así (`backend/src/middleware/clerkAuth.ts`):

1. Si ya es `owner` en la base de datos, se mantiene siempre.
2. Si el email está en `ADMIN_EMAILS`, se guarda como `admin`.
3. En cualquier otro caso, `customer`.

`ADMIN_EMAILS` y `MONGODB_URI` son variables de entorno **por despliegue**, no algo compartido
automáticamente. Además Clerk usa instancias separadas para dev (`sk_test_`/`pk_test_`) y
producción (`sk_live_`/`pk_live_`): el mismo email genera un `clerkId` y un `User` **distintos**
en cada instancia.

Consecuencia: correr `bun run set-owner -- <email>` (o tener `ADMIN_EMAILS` configurado) contra
el `.env` local de desarrollo **no otorga nada en producción** — production corre en Koyeb
(ver `vercel.json`, `/api/*` → `excessive-lara-personal-api-school-2d60e8b3.koyeb.app`) con su
propia configuración de entorno.

## Cómo verificar

`bun run set-owner` ahora imprime, antes de escribir:

- El cluster de Mongo al que se conectó (host, sin credenciales).
- Si `CLERK_SECRET_KEY` es de producción (`sk_live_`) o de test (`sk_test_`).

Si el usuario no aparece con ese email, significa que nunca inició sesión en ese entorno
específico (Clerk + Mongo) — hace falta iniciar sesión una vez en producción primero.

## Cómo otorgar acceso en producción

1. El usuario debe iniciar sesión al menos una vez en https://healthora-shop.vercel.app con la
   cuenta destino, para que se cree su `User` en la base de producción.
2. En el panel de Koyeb del servicio backend, confirmar/agregar `ADMIN_EMAILS` con el email (esto
   da `admin`, no `owner`).
3. Para `owner` (rol único, no asignable desde la UI), correr `bun run set-owner -- <email>` con
   las variables de entorno de **producción** (`MONGODB_URI` y `CLERK_SECRET_KEY` de Koyeb, no las
   del `.env` local) y confirmar en la salida que apunta al cluster/Clerk correctos.
