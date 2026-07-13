import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Order } from '../../db/models/Order';
import { jsonResult } from '../toolHelpers';
import { getCohortReport } from '../../lib/cohortAnalytics';

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
    'analytics.getCohortReport',
    {
      title: 'Reporte de cohortes y LTV',
      description:
        'Agrupa clientes por el mes de su primera compra pagada (cohorte) y calcula, por cada mes transcurrido desde esa cohorte, la retención (% que volvió a comprar) y el LTV acumulado por cliente. Incluye promedios generales (órdenes/cliente, revenue/cliente, ticket promedio). Requiere rol Admin. Equivalente al reporte de Cohortes/LTV del admin (HU-052).',
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
