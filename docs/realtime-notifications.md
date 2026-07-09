# Notificaciones en tiempo real (WebSockets) — HU-061

Canal de notificaciones en tiempo real con WebSockets sobre Hono/Bun, con un centro de
notificaciones **persistente** en el frontend. Cierra la issue #65.

## Qué resuelve

Como **Cliente**, recibir avisos al instante (pago confirmado, pedido enviado/entregado) sin
recargar. Como **Admin**, enterarse en el momento de **stock bajo** y **nuevas reseñas**.

## Arquitectura

```
                 evento de dominio (pago, envío, reseña, stock)
                                   │
        lib/realtime.ts  ── createNotification() ──▶ Mongo (Notification)   ← fuente de verdad
                                   │                        ▲
                                   │ emitTo(audience)       │ GET /notifications (REST, con polling)
                                   ▼                        │
        registro de sockets en memoria ──push──▶ WebSocket ─┴─▶ React Query cache ─▶ campana + toasts
```

- **Persistencia primero.** Toda notificación se guarda en la colección `Notification`. El
  WebSocket es un *acelerador*: si el cliente estaba desconectado, la ve igual en el próximo
  `GET /notifications` o al recargar. Por eso el centro es persistente y no depende del socket.
- **Hub en memoria** (`backend/src/lib/realtime.ts`): un `Map<clerkId, Set<socket>>` para usuarios,
  un `Set` para admins y otro para todos. `emitTo()` es el único punto de fan-out — un puente Redis
  pub/sub (ioredis ya es dependencia) restauraría el push entre instancias sin tocar a los callers.
- **Estado de lectura por usuario** (`readBy: string[]`): una fila compartida `admin`/`all` puede
  quedar leída por un admin sin marcarse leída para el resto. El API colapsa `readBy` en un
  booleano `read` por solicitante.

## Audiencias

| audience | destinatarios | `recipientId` |
|---|---|---|
| `user` | un cliente concreto | Clerk id |
| `admin` | todos los administradores | — |
| `all` | todos los visitantes autenticados | — |

## Eventos que disparan notificaciones

| Evento | Origen | Audiencia | Tipo |
|---|---|---|---|
| Pago confirmado | `routes/webhooks.ts` (Stripe `checkout.session.completed`) | cliente | `order_paid` |
| Cambio de fulfillment (enviado, entregado…) | `routes/admin/adminOrders.ts` | cliente | `order_shipped` / `order_status` |
| Nueva reseña | `routes/reviews.ts` | admins | `new_review` |
| Stock bajo (venta o ajuste) | `webhooks.ts` + `mcp/tools/inventory.ts` | admins | `low_stock` |
| Difusión manual / agente | MCP `notifications.broadcast` | según `audience` | `broadcast` |

El aviso de stock bajo usa el umbral `LOW_STOCK_THRESHOLD` (por defecto **5**, igual que el
dashboard admin) y está **deduplicado**: no repite el aviso del mismo producto dentro de una
ventana de 6 h, para que una ráfaga de compras no genere una alerta por unidad vendida.

## Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/notifications?limit=` | Clerk | Bandeja del usuario (propias + `all` + `admin` si es admin) con `unread` |
| `PATCH` | `/notifications/:id/read` | Clerk | Marca una como leída (para el solicitante) |
| `POST` | `/notifications/read-all` | Clerk | Marca todas como leídas |
| `GET` | `/notifications/ws?token=<jwt>` | Clerk (token en query) | Upgrade a WebSocket |
| `GET` | `/notifications/ws/status` | pública | Conteo de sockets conectados (observabilidad) |

El token de Clerk viaja en el query param porque el handshake WebSocket del navegador no permite
cabecera `Authorization`. Se verifica en el upgrade; un token inválido cierra con código `1008`.

## MCP

`notifications.broadcast` — `audience` = `all` | `admins` | `user` (con `userId`), más `title`,
`body` y `link` opcional. Persiste y difunde en tiempo real. Requiere rol Admin.

## Frontend

- `NotificationsRealtime` (montado en `__root`): mantiene el socket con reconexión exponencial y
  vuelca los eventos al caché de React Query (`['notifications']`).
- `NotificationCenter`: la campana + panel desplegable en el header (solo con sesión).
- `NotificationToaster`: toasts transitorios al llegar un evento, en cualquier ruta (incluido
  `/admin`, por lo que el admin ve las alertas aunque no esté el header de tienda).
- **Fallback:** si el WebSocket no puede conectar (p. ej. un proxy que no hace upgrade), el hook
  `useNotifications` sigue refrescando por polling REST — el centro nunca queda inservible.

### Variables de entorno (frontend)

En desarrollo el socket usa el mismo origen (`/api/notifications/ws`) a través del proxy de Vite
(`ws: true`). En producción, donde `/api` es un *rewrite* que no hace upgrade de WebSocket, apunta
el socket directo al backend con **una** de estas:

- `VITE_BACKEND_WS_URL` — p. ej. `wss://api.midominio.com`
- `VITE_BACKEND_URL` — p. ej. `https://api.midominio.com` (se convierte a `wss://` automáticamente)

## Backend — variables de entorno

- `LOW_STOCK_THRESHOLD` (opcional, default `5`): umbral para el aviso de stock bajo a admins.
