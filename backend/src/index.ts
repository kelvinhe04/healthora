import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { connectDB } from './db/connection';
import { productsRouter } from './routes/products';
import { categoriesRouter } from './routes/categories';
import { ordersRouter } from './routes/orders';
import { checkoutRouter } from './routes/checkout';
import { promotionsRouter } from './routes/promotions';
import { cartRouter } from './routes/cart';
import { webhooksRouter } from './routes/webhooks';
import { adminDashboardRouter } from './routes/admin/adminDashboard';
import { adminAccessRouter } from './routes/admin/adminAccess';
import { adminOrdersRouter } from './routes/admin/adminOrders';
import { adminProductsRouter } from './routes/admin/adminProducts';
import { adminUploadsRouter } from './routes/admin/adminUploads';
import { adminUsersRouter } from './routes/admin/adminUsers';
import { adminSalesRouter } from './routes/admin/adminSales';
import { adminEarningsRouter } from './routes/admin/adminEarnings';
import { adminAuditLogsRouter } from './routes/admin/adminAuditLogs';
import { adminReturnsRouter } from './routes/admin/adminReturns';
import { returnsRouter } from './routes/returns';
import { adminReviewsRouter } from './routes/admin/adminReviews';
import { adminCategoriesRouter } from './routes/admin/adminCategories';
import { adminRepurchaseRemindersRouter } from './routes/admin/adminRepurchaseReminders';
import { adminAnalyticsRouter } from './routes/admin/adminAnalytics';
import { adminCatalogRouter } from './routes/admin/adminCatalog';
import { adminCouponsRouter } from './routes/admin/adminCoupons';
import { adminReportsRouter } from './routes/admin/adminReports';
import { wishlistRouter } from './routes/wishlist';
import { accountRouter } from './routes/account';
import { mcpAuth } from './mcp/auth';
import { handleMcpRequest } from './mcp/server';
import { sendOrderConfirmationEmail } from './lib/email';
import { recalculateBestsellers, recalculateNew, recalculatePurchasesLastMonth } from './lib/bestsellers';
import { scanAndSendRepurchaseReminders } from './lib/repurchase';
import { reviewsRouter } from './routes/reviews';
import { notificationsRouter, websocket } from './routes/notifications';
import { newsletterRouter } from './routes/newsletter';
import { ipRateLimit } from './middleware/rateLimit';
import { swaggerUI } from '@hono/swagger-ui';
import { openApiDocument } from './openapi';
import { emailField, parseJson, textField } from './lib/validation';
import { z } from 'zod';
import { logger } from './lib/logger';
import { requestLogger } from './middleware/requestLogger';
import { getCorsOrigins } from './lib/appEnv';
import { securityHeaders } from './middleware/securityHeaders';
import { clearCatalogCache } from './lib/cache';
import { cacheableJson } from './lib/httpCache';

const testEmailSchema = z.object({
  email: emailField(),
  name: textField(120).optional(),
});

await connectDB();
await clearCatalogCache();
await recalculateBestsellers();
await recalculateNew();
await recalculatePurchasesLastMonth();

// Recordatorio de recompra (HU-102): corre una vez al iniciar y despues cada 24h. No bloquea el
// arranque del servidor (fire-and-forget) y se desactiva en tests para no mandar/crear datos
// fuera de los tests que lo ejercitan explicitamente.
if (process.env.NODE_ENV !== 'test') {
  void scanAndSendRepurchaseReminders().catch((err) => logger.error({ err }, '[REPURCHASE] Error en el escaneo inicial'));
  setInterval(() => {
    scanAndSendRepurchaseReminders().catch((err) => logger.error({ err }, '[REPURCHASE] Error en el escaneo periodico'));
  }, 24 * 60 * 60 * 1000).unref?.();
}

const app = new Hono();

app.use('*', securityHeaders);
app.use('*', requestLogger);
app.use('*', ipRateLimit);
const corsOrigins = getCorsOrigins();
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin || corsOrigins.includes(origin)) return origin ?? corsOrigins[0];
      return corsOrigins[0];
    },
    credentials: true,
  }),
);

app.route('/products', productsRouter);
app.route('/categories', categoriesRouter);
app.route('/orders', ordersRouter);
app.route('/returns', returnsRouter);
app.route('/account', accountRouter);
app.route('/reviews', reviewsRouter);
app.route('/notifications', notificationsRouter);
app.route('/newsletter', newsletterRouter);
app.route('/cart', cartRouter);
app.route('/wishlist', wishlistRouter);
app.route('/checkout', checkoutRouter);
app.route('/promotions', promotionsRouter);
app.route('/webhooks', webhooksRouter);
app.route('/admin/access', adminAccessRouter);
app.route('/admin/dashboard', adminDashboardRouter);
app.route('/admin/orders', adminOrdersRouter);
app.route('/admin/products', adminProductsRouter);
app.route('/admin/uploads', adminUploadsRouter);
app.route('/admin/users', adminUsersRouter);
app.route('/admin/sales', adminSalesRouter);
app.route('/admin/earnings', adminEarningsRouter);
app.route('/admin/audit-logs', adminAuditLogsRouter);
app.route('/admin/returns', adminReturnsRouter);
app.route('/admin/reviews', adminReviewsRouter);
app.route('/admin/categories', adminCategoriesRouter);
app.route('/admin/repurchase-reminders', adminRepurchaseRemindersRouter);
app.route('/admin/analytics', adminAnalyticsRouter);
app.route('/admin/catalog', adminCatalogRouter);
app.route('/admin/coupons', adminCouponsRouter);
app.route('/admin/reports', adminReportsRouter);

// Remote MCP server (Model Context Protocol) - exposes read/write tools for catalog, variantes,
// stock, ordenes, usuarios y ventas, importable desde Claude Code / Codex / conectores de
// ChatGPT. Gated behind MCP_SERVICE_TOKEN (see mcp/auth.ts), not Clerk - it's a headless client,
// not a browser session. See docs/mcp-server.md.
app.all('/mcp', mcpAuth, async (c) => handleMcpRequest(c.req.raw));

app.get('/health', (c) => c.json({ status: 'ok' }));

app.get('/openapi.json', (c) => cacheableJson(c, openApiDocument, 'staticDocument'));
app.get('/docs', swaggerUI({ url: '/openapi.json' }));

app.post('/test-email', async (c) => {
  const parsed = await parseJson(c, testEmailSchema);
  if (!parsed.success) return parsed.response;

  const { email, name } = parsed.data;
  await sendOrderConfirmationEmail({
    customerName: name || 'Test User',
    customerEmail: email,
    orderId: 'test-order-12345678',
    items: [
      { productId: 'test-1', productName: 'Producto de prueba', qty: 1, price: 29.99 }
    ],
    subtotal: 29.99,
    tax: 2.10,
    shipping: 6.90,
    total: 38.99,
    address: {
      name: name || 'Test User',
      phone: '1234567890',
      address: 'Calle Falsa 123',
      city: 'Ciudad de Mexico',
      postal: '06600'
    },
    createdAt: new Date(),
  });
  return c.json({ success: true, message: 'Email sent to ' + email });
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error('[API]', err);
  return c.json({ error: 'Internal server error' }, 500);
});

const port = Number(process.env.PORT) || 3002;

Bun.serve({
  fetch: app.fetch,
  websocket,
  port,
  maxRequestBodySize: 20 * 1024 * 1024,
});

logger.info({ port }, 'Healthora backend running');
