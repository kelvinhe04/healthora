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
import { accountRouter } from './routes/account';
import { reviewsRouter } from './routes/reviews';

await connectDB();

const app = new Hono();

app.use('*', cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));

app.route('/products', productsRouter);
app.route('/categories', categoriesRouter);
app.route('/orders', ordersRouter);
app.route('/account', accountRouter);
app.route('/reviews', reviewsRouter);
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

app.get('/health', (c) => c.json({ status: 'ok' }));

const port = Number(process.env.PORT) || 3001;

Bun.serve({
  fetch: app.fetch,
  port,
  maxRequestBodySize: 20 * 1024 * 1024,
});

console.log(`Healthora backend running on :${port}`);
