import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { upsertCategory } from '../../lib/categoryAdmin';
import { optionalTextField, productIdSchema, textField } from '../../lib/validation';
import { errorResult, jsonResult } from '../toolHelpers';

export function registerCategoryTools(server: McpServer) {
  server.registerTool(
    'categories.upsertCategory',
    {
      title: 'Crear o actualizar categoría',
      description:
        'Crea una categoría nueva o actualiza label/sub/color/active. Con newId renombra la categoría y reasigna productos. Equivalente al panel "Gestión de categorías" del admin (HU-048).',
      inputSchema: {
        id: productIdSchema,
        label: textField(120).optional(),
        sub: optionalTextField(160),
        color: optionalTextField(80),
        active: z.boolean().optional(),
        newId: productIdSchema.optional(),
      },
    },
    async (input) => {
      try {
        const result = await upsertCategory(input);
        return jsonResult(result);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : 'Error al guardar categoría');
      }
    },
  );
}
