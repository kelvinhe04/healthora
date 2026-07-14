import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Order } from '../../db/models/Order';
import { getCohortReport } from '../../lib/cohortAnalytics';
import { getProductAnalytics } from '../../lib/posthogAnalytics';
import { jsonResult } from '../toolHelpers';

export function registerAnalyticsTools(server: McpServer) {
  server.registerTool(
    'analytics.getSalesReport',
    {
      title: 'Reporte de ventas',
      description:
        'Métricas de ventas y ganancias: revenue total, ticket promedio, unidades vendidas y el top 5 de productos por revenue, sobre los últimos N días (default 30). Requiere rol Admin. Equivalente al panel de Ventas del admin (HU-019).',
      inputSchema: {
        days: z.number().int().min(1).max(365).optional().default(30),
      },
    },
    async ({ days }) => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [summary] = await Order.aggregate([
        { $match: { paymentStatus: 'paid', createdAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: '$total' },
            avgOrderValue: { $avg: '$total' },
            totalUnits: { $sum: { $sum: '$items.qty' } },
          },
        },
      ]);

      const topProducts = await Order.aggregate([
        { $match: { paymentStatus: 'paid', createdAt: { $gte: since } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productName',
            units: { $sum: '$items.qty' },
            revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        { $project: { name: '$_id', units: 1, revenue: 1, _id: 0 } },
      ]);

      return jsonResult({
        periodDays: days,
        summary: summary || { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0, totalUnits: 0 },
        topProducts,
      });
    },
  );

  server.registerTool(
    'analytics.getProductAnalytics',
    {
      title: 'Analítica de producto (PostHog)',
      description:
        'Embudo de checkout (checkout_started -> checkout_completed) y tasa de conversión, y abandono de carrito (add_to_cart sin checkout_completed), sobre los últimos N días (default 30). Requiere rol Admin. Equivalente al panel de Analítica del admin (HU-054). Si PostHog no está configurado (POSTHOG_PERSONAL_API_KEY/POSTHOG_PROJECT_ID), devuelve el embudo en cero con `configured: false`.',
      inputSchema: {
        days: z.number().int().min(1).max(365).optional().default(30),
      },
    },
    async ({ days }) => {
      const analytics = await getProductAnalytics(days);
      return jsonResult(analytics);
    },
  );

  server.registerTool(
    'analytics.getCohortReport',
    {
      title: 'Reporte de cohortes y LTV',
      description:
        'Agrupa clientes por el mes de su primera compra pagada (cohorte) y calcula retención y LTV acumulado por mes. Equivalente al reporte Cohortes/LTV del admin (HU-052).',
      inputSchema: {
        from: z.string().optional().describe('Fecha ISO: solo cohortes cuyo primer mes de compra sea igual o posterior.'),
        to: z.string().optional().describe('Fecha ISO: solo cohortes cuyo primer mes de compra sea igual o anterior.'),
      },
    },
    async ({ from, to }) => {
      const report = await getCohortReport({
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      });
      return jsonResult(report);
    },
  );
}
