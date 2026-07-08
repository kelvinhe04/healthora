import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Product } from '../../db/models/Product';
import { productIdSchema, textField } from '../../lib/validation';
import { errorResult, jsonResult } from '../toolHelpers';

export function registerInventoryTools(server: McpServer) {
  server.registerTool(
    'inventory.adjustStock',
    {
      title: 'Consultar o ajustar stock',
      description:
        'Sin `delta`: consulta el stock actual de un producto o combinación. Con `delta` (positivo o negativo): suma/resta unidades - nunca baja de 0. Para una combinación usa variantId "primarioId:tamañoId"; para una variante simple, solo su id; sin variantId, opera sobre el stock general del producto. Requiere rol Admin (HU-037).',
      inputSchema: {
        productId: productIdSchema,
        variantId: textField(200).optional(),
        delta: z.coerce.number().int().optional(),
      },
    },
    async ({ productId, variantId, delta }) => {
      const product = await Product.findOne({ id: productId });
      if (!product) return errorResult(`Producto "${productId}" no encontrado.`);

      const readOnly = delta === undefined;
      let current: number;
      let apply: () => void;

      if (!variantId) {
        current = product.stock;
        apply = () => {
          product.stock = Math.max(0, current + (delta ?? 0));
        };
      } else if (variantId.includes(':')) {
        const [primaryId, sizeId] = variantId.split(':');
        const primary = product.variants?.find((v) => v.id === primaryId);
        if (!primary) return errorResult(`Combinación "${variantId}" no encontrada en "${productId}".`);
        current = primary.stockBySize?.[sizeId] ?? 0;
        apply = () => {
          primary.stockBySize = { ...(primary.stockBySize ?? {}), [sizeId]: Math.max(0, current + (delta ?? 0)) };
          product.markModified('variants');
        };
      } else {
        const variant = product.variants?.find((v) => v.id === variantId);
        if (!variant) return errorResult(`Variante "${variantId}" no encontrada en "${productId}".`);
        current = variant.stock;
        apply = () => {
          variant.stock = Math.max(0, current + (delta ?? 0));
        };
      }

      if (readOnly) return jsonResult({ productId, variantId: variantId ?? null, stock: current });

      apply();
      await product.save();
      const newStock = Math.max(0, current + (delta ?? 0));
      return jsonResult({ productId, variantId: variantId ?? null, previousStock: current, delta, stock: newStock });
    },
  );
}
