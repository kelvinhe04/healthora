import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { connectDB } from './db/connection';
import { productsRouter } from './routes/products';
import { categoriesRouter } from './routes/categories';
import { ordersRouter } from './routes/orders';
import { checkoutRouter } from './routes/checkout';
import { cartRouter } from './routes/cart';
import { webhooksRouter } from './routes/webhooks';
import { adminDashboardRouter } from './routes/admin/adminDashboard';
import { adminAccessRouter } from './routes/admin/adminAccess';
import { adminOrdersRouter } from './routes/admin/adminOrders';
import { adminProductsRouter } from './routes/admin/adminProducts';
import { adminUsersRouter } from './routes/admin/adminUsers';
import { adminSalesRouter } from './routes/admin/adminSales';
import { adminEarningsRouter } from './routes/admin/adminEarnings';
import { adminPerformanceRouter } from './routes/admin/adminPerformance';
import { adminErrorReportsRouter } from './routes/admin/adminErrorReports';
import { adminAuditLogsRouter } from './routes/admin/adminAuditLogs';
import { accountRouter } from './routes/account';
import { sendOrderConfirmationEmail } from './lib/email';
import { recalculateBestsellers, recalculateNew } from './lib/bestsellers';
import { reviewsRouter } from './routes/reviews';
import { newsletterRouter } from './routes/newsletter';
import { errorReportsRouter } from './routes/errorReports';
import { swaggerUI } from '@hono/swagger-ui';
import { openApiDocument } from './openapi';
import { emailField, parseJson, textField } from './lib/validation';
import { z } from 'zod';
import { performanceMetrics } from './middleware/performanceMetrics';
import { captureException } from './lib/errorTracking';
import { shutdownPostHog } from './lib/posthog';
import { errorTracking } from './middleware/errorTracking';
import { logger } from './lib/logger';
import { requestLogger } from './middleware/requestLogger';
import { getCorsOrigins } from './lib/appEnv';
import { securityHeaders } from './middleware/securityHeaders';
import { clearCatalogCache } from './lib/cache';

const testEmailSchema = z.object({
  email: emailField(),
  name: textField(120).optional(),
});

await connectDB();
await clearCatalogCache();
await recalculateBestsellers();
await recalculateNew();

const app = new Hono();

app.use('*', securityHeaders);
app.use('*', requestLogger);
app.use('*', errorTracking);
app.use('*', performanceMetrics);
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
app.route('/account', accountRouter);
app.route('/reviews', reviewsRouter);
app.route('/newsletter', newsletterRouter);
app.route('/error-reports', errorReportsRouter);
app.route('/cart', cartRouter);
app.route('/checkout', checkoutRouter);
app.route('/webhooks', webhooksRouter);
app.route('/admin/access', adminAccessRouter);
app.route('/admin/dashboard', adminDashboardRouter);
app.route('/admin/orders', adminOrdersRouter);
app.route('/admin/products', adminProductsRouter);
app.route('/admin/users', adminUsersRouter);
app.route('/admin/sales', adminSalesRouter);
app.route('/admin/earnings', adminEarningsRouter);
app.route('/admin/performance', adminPerformanceRouter);
app.route('/admin/error-reports', adminErrorReportsRouter);
app.route('/admin/audit-logs', adminAuditLogsRouter);

app.get('/health', (c) => c.json({ status: 'ok' }));

app.get('/openapi.json', (c) => c.json(openApiDocument));
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
  port,
  maxRequestBodySize: 20 * 1024 * 1024,
});

logger.info({ port }, 'Healthora backend running');

process.on('uncaughtException', (error) => {
  captureException({
    source: 'backend',
    error,
    severity: 'fatal',
    metadata: { handler: 'uncaughtException' },
  });
});

process.on('unhandledRejection', (reason) => {
  captureException({
    source: 'backend',
    error: reason,
    severity: 'fatal',
    metadata: { handler: 'unhandledRejection' },
  });
});

process.on('beforeExit', () => {
  void shutdownPostHog();
});
