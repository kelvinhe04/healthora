import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { clearCatalogCache } from '../../lib/cache';
import { jsonResult } from '../toolHelpers';

export function registerSearchTools(server: McpServer) {
  server.registerTool(
    'search.reindexCatalog',
    {
      title: 'Invalidar caché del catálogo',
      description:
        'Limpia la caché del catálogo (Redis o memoria) para que la próxima consulta refleje cambios recientes de productos/categorías. Equivalente al botón "Refrescar catálogo" del admin.',
      inputSchema: {},
    },
    async () => {
      await clearCatalogCache();
      return jsonResult({ ok: true, message: 'Caché del catálogo invalidada.' });
    },
  );
}
