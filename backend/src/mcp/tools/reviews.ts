import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Review } from '../../db/models/Review';
import { productIdSchema } from '../../lib/validation';
import { jsonResult } from '../toolHelpers';

export function registerReviewTools(server: McpServer) {
  server.registerTool(
    'reviews.listReviews',
    {
      title: 'Listar reseñas de un producto',
      description: 'Lista las reseñas de un producto, más recientes primero. Equivalente a la sección de reseñas en la ficha de producto (HU-010).',
      inputSchema: {
        productId: productIdSchema,
        limit: z.number().int().min(1).max(50).optional().default(10),
      },
    },
    async ({ productId, limit }) => {
      const reviews = await Review.find({ productId }).sort({ createdAt: -1 }).limit(limit).lean();
      const avgRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
      return jsonResult({ productId, count: reviews.length, avgRating: Math.round(avgRating * 10) / 10, reviews });
    },
  );
}
