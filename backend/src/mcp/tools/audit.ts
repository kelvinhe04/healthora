import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { jsonResult } from '../toolHelpers';
import { listAuditLogs } from '../../lib/auditLogs';

export function registerAuditTools(server: McpServer) {
  server.registerTool(
    'audit.getAdminActions',
    {
      title: 'Registro de auditoría administrativa',
      description:
        'Consulta el registro de auditoría (append-only, no editable) de acciones realizadas por administradores: quién, qué acción, sobre qué recurso y cuándo. Filtrable por actor (clerkId o email), tipo de acción y rango de fechas. Requiere rol Admin (HU-051).',
      inputSchema: {
        actorEmail: z.string().optional(),
        actorClerkId: z.string().optional(),
        action: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        page: z.number().int().min(1).optional().default(1),
        limit: z.number().int().min(1).max(200).optional().default(50),
      },
    },
    async (input) => jsonResult(await listAuditLogs(input)),
  );
}
