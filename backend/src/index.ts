import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { connectDB } from './db/connection';
import { productsRouter } from './routes/products';
import { categoriesRouter } from './routes/categories';
import { ordersRouter } from './routes/orders';
import { checkoutRouter } from './routes/checkout';
import { webhooksRouter } from './routes/webhooks';
import { adminDashboardRouter } from './routes/admin/adminDashboard';
import { adminOrdersRouter } from './routes/admin/adminOrders';
import { adminProductsRouter } from './routes/admin/adminProducts';
import { adminUsersRouter } from './routes/admin/adminUsers';
import { adminSalesRouter } from './routes/admin/adminSales';
import { adminEarningsRouter } from './routes/admin/adminEarnings';

await connectDB();

const app = new Elysia()
  .use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }))
  .use(productsRouter)
  .use(categoriesRouter)
  .use(ordersRouter)
  .use(checkoutRouter)
  .use(webhooksRouter)
  .use(adminDashboardRouter)
  .use(adminOrdersRouter)
  .use(adminProductsRouter)
  .use(adminUsersRouter)
  .use(adminSalesRouter)
  .use(adminEarningsRouter)
  .get('/health', () => ({ status: 'ok' }))
  .listen(Number(process.env.PORT) || 3001);

console.log(`Healthora backend running on :${app.server?.port}`);
