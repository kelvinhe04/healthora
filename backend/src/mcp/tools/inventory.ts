import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Product } from '../../db/models/Product';
import { productIdSchema, textField } from '../../lib/validation';
import { errorResult, jsonResult } from '../toolHelpers';
import { getTotalStock } from '../../lib/productVariants';
import { scanAndNotifyLowStock } from '../../lib/lowStock';

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
        if (product.variants?.length) {
          // Product-level `stock` is a stale denormalized cache once combos exist - real stock
          // lives per combo/variant, so a blind write here would silently touch a column nothing
          // reads. Reads return the live combo-aware total; writes must target a variantId.
          if (readOnly) return jsonResult({ productId, variantId: null, stock: getTotalStock(product) });
          return errorResult(
            `"${productId}" tiene variantes/combinaciones - especifica variantId para ajustar su stock.`,
          );
        }
        current = product.stock;
        apply = () => {
          product.stock = Math.max(0, current + (delta ?? 0));
        };
      } else if (variantId.includes(':')) {
        const [primaryId, sizeId] = variantId.split(':');
        const primary = product.variants?.find((v) => v.id === primaryId);
        const size = product.variants?.find((v) => v.id === sizeId && v.type === 'size');
        if (!primary || !size) return errorResult(`Combinación "${variantId}" no encontrada en "${productId}".`);
        // Same fallback chain as resolveVariantPricing: a combo without its own stockBySize
        // override shares the tamaño's stock - falling back to `?? 0` here (no size lookup)
        // would silently read every un-overridden combo as out of stock.
        current = primary.stockBySize?.[sizeId] ?? size.stock ?? 0;
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

      // A reducing adjustment can push a variant/combo under the low-stock threshold - alert admins
      // in real time (HU-061), per cell and deduped so repeated adjustments don't spam. Best-effort.
      if ((delta ?? 0) < 0) {
        try {
          await scanAndNotifyLowStock(product.toObject());
        } catch (notifyError) {
          console.error('[MCP inventory.adjustStock] low_stock notification failed:', notifyError);
        }
      }

      return jsonResult({ productId, variantId: variantId ?? null, previousStock: current, delta, stock: newStock });
    },
  );
}
