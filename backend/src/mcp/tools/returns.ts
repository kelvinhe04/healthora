import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { objectIdSchema } from '../../lib/validation';
import { updateReturnStatus } from '../../lib/returns';
import { errorResult, jsonResult } from '../toolHelpers';

const returnStatusSchema = z.enum([
  'requested',
  'approved',
  'in_transit',
  'in_review',
  'refunded',
  'replaced',
  'rejected',
]);

export function registerReturnTools(server: McpServer) {
  server.registerTool(
    'returns.approveReturn',
    {
      title: 'Actualizar estado de devolución',
      description:
        'Aprueba, rechaza o avanza una devolución/reembolso (approved, in_transit, in_review, refunded, replaced, rejected). Para refunded solicita el reembolso en Stripe y deja la devolución en refund_pending hasta confirmación. Equivalente a la sección Devoluciones del admin (HU-041).',
      inputSchema: {
        returnId: objectIdSchema,
        status: returnStatusSchema,
      },
    },
    async ({ returnId, status }) => {
      const result = await updateReturnStatus(returnId, status);
      if (!result.ok) return errorResult(result.error);
      return jsonResult(result.return);
    },
  );
}
