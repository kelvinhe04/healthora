import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Product } from '../../db/models/Product';
import { productIdSchema } from '../../lib/validation';
import { errorResult, jsonResult } from '../toolHelpers';

type ScoredProduct = { id: string; category: string; need?: string; brand: string; tag?: string; rating?: number };

/** Mirrors frontend/src/lib/relatedProducts.ts `scoreRelated` - same weights, reimplemented
 * server-side since that logic only ever ran client-side against an already-fetched catalog. */
function scoreRelated(source: ScoredProduct, candidate: ScoredProduct): number {
  let score = 0;
  if (candidate.category === source.category) score += 3;
  if (candidate.need === source.need) score += 2;
  if (candidate.brand === source.brand) score += 1;
  if (candidate.tag === source.tag && candidate.tag) score += 1;
  return score;
}

export function registerRecommendationTools(server: McpServer) {
  server.registerTool(
    'recommendations.getRelatedProducts',
    {
      title: 'Productos relacionados',
      description:
        'Devuelve productos relacionados a uno dado (misma categoría/necesidad/marca/tag), ordenados por relevancia. Equivalente a la sección "También te puede interesar" de la ficha de producto (HU-045).',
      inputSchema: {
        productId: productIdSchema,
        limit: z.number().int().min(1).max(20).optional().default(4),
      },
    },
    async ({ productId, limit }) => {
      const source = await Product.findOne({ id: productId }).select('id category need brand tag').lean();
      if (!source) return errorResult(`Producto "${productId}" no encontrado.`);

      const pool = await Product.find({ id: { $ne: productId }, active: true })
        .select('id name brand category need tag rating price')
        .lean();

      const related = pool
        .map((product) => ({ product, score: scoreRelated(source, product) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || (b.product.rating ?? 0) - (a.product.rating ?? 0))
        .slice(0, limit)
        .map((entry) => entry.product);

      return jsonResult({ productId, count: related.length, related });
    },
  );
}
