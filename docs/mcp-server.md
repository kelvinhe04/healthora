# Servidor MCP — Implementación

PR: `feat/mcp-server`

---

## Qué es

Un servidor [MCP](https://modelcontextprotocol.io) (Model Context Protocol) montado sobre el mismo backend de Hono, en `POST /mcp`. Expone como "tools" (funciones invocables por un agente) un subconjunto de las capacidades administrativas de Healthora — catálogo, variantes, stock, órdenes, usuarios, ventas — para que Claude Code, Codex o un conector de ChatGPT puedan operarlas directamente, sin pasar por la UI ni por scraping/browsing.

No es un servicio aparte: corre dentro del mismo proceso Bun/Hono que ya está desplegado en Koyeb, en la ruta `/mcp`.

---

## Regla de alcance: MCP ⊆ UI

Solo se expone como tool MCP una capacidad que **ya existe en la interfaz** (`Healthora-Historias-de-Usuario.docx`, sección 6). Las **24 tools del `.docx`** están cubiertas; además hay **5 extras** — **29 en total**.

## Tools implementadas (29)

| Tool | HU | Qué hace | Auth |
|---|---|---|---|
| `catalog.listProducts` | HU-001 | Filtra el catálogo por categoría/marca/stock/texto | Servicio |
| `catalog.upsertProduct` | HU-016 | Crea o actualiza un producto | Servicio |
| `categories.upsertCategory` | HU-048 | Crea o actualiza una categoría; con `newId` renombra y reasigna productos | Servicio |
| `variants.upsertVariant` | HU-032 | Crea o actualiza una variante dentro de un producto | Servicio |
| `variants.updateVariantStock` | HU-034 | Fija el stock (valor absoluto) de una combinación sabor×tamaño o variante simple | Servicio |
| `variants.uploadVariantImage` | — | Sube una imagen de variante a Cloudinary | Servicio |
| `inventory.adjustStock` | HU-037 | Consulta el stock actual, o lo ajusta con un delta (+/-) | Servicio |
| `orders.listUserOrders` | HU-009 | Lista las órdenes de un usuario (email o customerId) | Servicio |
| `orders.updateOrderStatus` | HU-018 | Cambia paymentStatus/fulfillmentStatus (envía el email al cliente, igual que el admin) | Servicio |
| `orders.getOrderItems` | HU-036 | Ítems de una orden con su variante/combo comprado | Servicio |
| `orders.exportOrdersCsv` | HU-050 | Exporta pedidos a CSV con filtros opcionales | Servicio |
| `users.updateUserRole` | HU-017 | Promueve/degrada un usuario (sincroniza con Clerk) | Servicio |
| `analytics.getSalesReport` | HU-019 | Revenue, ticket promedio, unidades y top 5 productos en N días | Servicio |
| `analytics.getProductAnalytics` | HU-054 | Embudo de checkout, abandono de carrito (PostHog) y errores recientes en N días | Servicio |
| `analytics.getCohortReport` | HU-052 | Cohortes por mes de primera compra, retención y LTV | Servicio |
| `reviews.listReviews` | HU-010 | Reseñas de un producto | Servicio |
| `reviews.moderateReview` | HU-056 | Aprueba, oculta o elimina una reseña; recalcula el rating del producto | Servicio |
| `reviews.banAuthor` | HU-194 | Banea al autor de una reseña para ese producto y elimina la reseña | Servicio |
| `recommendations.getRelatedProducts` | HU-045 | Productos relacionados (misma categoría/necesidad/marca/tag) | Servicio |
| `notifications.broadcast` | HU-061 | Difunde una notificación en tiempo real (WebSockets) a todos, admins o un cliente; queda persistida en el centro de notificaciones | Servicio |
| `promotions.validateCoupon` | HU-040 | Valida un cupón contra ítems del carrito (subtotal elegible, expiración, primera compra) | Servicio |
| `promotions.applyDiscount` | HU-092 | Aplica o quita un descuento masivo por categoría | Servicio |
| `coupons.createCoupon` | HU-049 | Crea un cupón promocional | Servicio |
| `coupons.listCoupons` | HU-049 | Lista cupones promocionales del admin | Servicio |
| `returns.approveReturn` | HU-041 | Avanza el estado de una devolución/reembolso | Servicio |
| `returns.listReturns` | HU-041 | Lista solicitudes de devolución con filtro opcional por estado | Servicio |
| `search.reindexCatalog` | — | Invalida la caché del catálogo | Servicio |
| `audit.getAdminActions` | HU-051 | Consulta el registro de auditoría administrativa | Servicio |
| `wishlist.getUserWishlist` | HU-044 | Lista la wishlist persistida de un usuario (email o customerId) | Servicio |

Código en `backend/src/mcp/` — un archivo por módulo bajo `tools/`, más `server.ts` (arma el `McpServer` y el transporte) y `auth.ts` (middleware de autenticación).

---

## Autenticación

Un único token de servicio (`MCP_SERVICE_TOKEN`), no Clerk — un cliente MCP headless (Claude Code corriendo en tu compu, o un conector de ChatGPT) no puede hacer el login interactivo de Clerk. Todas las tools son de nivel Admin, así que un solo secreto compartido alcanza.

**Generar el token:**
```bash
openssl rand -hex 32
```

**Configurarlo:**
- Local: `MCP_SERVICE_TOKEN=...` en `backend/.env`
- Producción (Koyeb): agregar la misma variable de entorno en la config del servicio

**Usarlo:** header `Authorization: Bearer <token>` en cada request a `/mcp`. Sin el header (o con un token incorrecto), la ruta responde `401`. Si el servidor no tiene `MCP_SERVICE_TOKEN` configurado, responde `503` (para no arrancar con un endpoint admin abierto sin auth por accidente).

---

## Conectar un cliente

### Claude Code / Claude Desktop

```json
{
  "mcpServers": {
    "healthora": {
      "url": "https://<tu-backend>.koyeb.app/mcp",
      "headers": { "Authorization": "Bearer <MCP_SERVICE_TOKEN>" }
    }
  }
}
```

### ChatGPT (Connectors)

Configuración → Connectors → Agregar conector personalizado:
- URL: `https://<tu-backend>.koyeb.app/mcp`
- Auth: header `Authorization: Bearer <MCP_SERVICE_TOKEN>`

### Local (desarrollo)

`http://localhost:3002/mcp` con el mismo token de `backend/.env`.

---

## Detalles de implementación

- **Transporte**: `WebStandardStreamableHTTPServerTransport` del SDK oficial (`@modelcontextprotocol/sdk`), la variante pensada para runtimes con Fetch API (Bun/Deno/Cloudflare Workers) en vez de `http.IncomingMessage`/`ServerResponse` de Node — encaja directo con `Bun.serve({ fetch: app.fetch })` y Hono (`transport.handleRequest(c.req.raw)`).
- **Stateless, sin sesión**: sin `sessionIdGenerator`, cada request es independiente (la autenticación ya viaja en cada llamada vía el Bearer token, no hay estado de conversación que mantener del lado del servidor).
- **Un server+transporte nuevo por request**: el SDK no permite reconectar un `McpServer` a un segundo transporte, ni reusar un transporte stateless para más de un request ("Create a new transport per request" — reusarlo mezclaría IDs de mensajes entre llamadas distintas). `handleMcpRequest()` en `server.ts` arma un `McpServer` + transporte efímero por cada `POST /mcp` y los cierra al terminar. El registro de tools es una operación pura (arma un `Map`, sin I/O), así que esto no tiene costo real.
- **Respuesta JSON simple** (`enableJsonResponse: true`), no streaming SSE — ninguna de estas tools necesita enviar resultados parciales.
- Reusa la lógica existente del backend donde tiene sentido (`combineOrderStatus`, `normalizeOrder`, `sendOrderStatusUpdateEmail`, sincronización de rol con Clerk) en vez de reimplementarla, para que el comportamiento sea idéntico al de usar la UI del admin.

## Tests

`backend/src/mcp/mcp.integration.test.ts` (mongodb-memory-server): `initialize`, `tools/list` (verifica las 29 tools registradas), y `tools/call` contra un producto matrix real (sabor×tamaño con `stockBySize`) y reseñas (aprobar/ocultar/eliminar), incluyendo casos de error (tool inexistente, reviewId inexistente).
