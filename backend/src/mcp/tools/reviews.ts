import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Review } from '../../db/models/Review';
import { objectIdSchema, productIdSchema } from '../../lib/validation';
import { errorResult, jsonResult } from '../toolHelpers';
import { recomputeProductRating } from '../../lib/productRatings';

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

  server.registerTool(
    'reviews.moderateReview',
    {
      title: 'Moderar una reseña',
      description:
        'Aprueba (publica), oculta o elimina una reseña de cliente, identificada por su id de Mongo. Ocultar/eliminar la quita de la ficha pública y del cálculo de rating del producto. Requiere rol Admin. Equivalente a la sección Reseñas del admin (HU-056).',
      inputSchema: {
        reviewId: objectIdSchema,
        action: z.enum(['approve', 'hide', 'delete']),
      },
    },
    async ({ reviewId, action }) => {
      if (action === 'delete') {
        const review = await Review.findByIdAndDelete(reviewId).lean();
        if (!review) return errorResult('Reseña no encontrada.');
        await recomputeProductRating(review.productId);
        return jsonResult({ reviewId, action, deleted: true });
      }

      const status = action === 'approve' ? 'published' : 'hidden';
      const review = await Review.findByIdAndUpdate(reviewId, { status }, { returnDocument: 'after' }).lean();
      if (!review) return errorResult('Reseña no encontrada.');
      await recomputeProductRating(review.productId);
      return jsonResult(review);
    },
  );
}
