# Otorgar acceso admin/owner en producción

Ver issue: "Sin acceso admin/owner en la página de producción" (healthora-shop.vercel.app).

## Causa raíz real de #251: tokens rechazados por `authorizedParties`

`backend/src/middleware/clerkAuth.ts` (y el WS handshake en `routes/notifications.ts`) validan
cada token de Clerk contra una whitelist de orígenes (`authorizedParties`, sobre el claim `azp`
del JWT). Esa lista estaba hardcodeada a los puertos de dev local (`localhost:5173/5175/3001`) y
nunca incluía `https://healthora-shop.vercel.app`. Resultado: Clerk rechazaba **cualquier** token
emitido desde producción y el backend devolvía `401 Invalid token` en **todos** los endpoints
autenticados, no solo en el panel admin — el frontend traga ese error en un `catch` silencioso
(`Header.tsx`, `loadAdminState`), así que nunca se veía un error explícito, solo faltaba la opción
de admin en el menú.

Esto explicaba el síntoma incluso con `role: owner` ya asignado correctamente en Mongo.

Fix: `getAuthorizedParties()` en `backend/src/lib/appEnv.ts` combina los orígenes de
`CORS_ORIGINS`/`FRONTEND_URL` (los mismos que ya se usaban para CORS) con los puertos de dev, y
`clerkAuth.ts`/`notifications.ts` lo usan en vez de la constante hardcodeada.

**Acción pendiente en Koyeb:** agregar `CORS_ORIGINS=https://healthora-shop.vercel.app` (sumar
previews de Vercel separados por coma si hace falta probarlos) — hoy `FRONTEND_URL` está seteado a
`http://localhost:5173`, que ya no alcanza como único origen autorizado para producción.

## Causa raíz (mismatch de entorno dev/prod, real pero secundaria a lo anterior)

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
