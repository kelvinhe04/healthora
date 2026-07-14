import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDashboardSummary } from '../../lib/dashboardSummary';
import { jsonResult } from '../toolHelpers';

export function registerDashboardTools(server: McpServer) {
  server.registerTool(
    'dashboard.getSummary',
    {
      title: 'Resumen del dashboard admin',
      description:
        'KPIs del mes (revenue, pedidos, usuarios, stock bajo), ventas diarias de los últimos 30 días, pedidos recientes y variantes con stock bajo. Equivalente al Dashboard del admin (HU-015).',
      inputSchema: {},
    },
    async () => jsonResult(await getDashboardSummary()),
  );
}
