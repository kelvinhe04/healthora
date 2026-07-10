import { Hono } from 'hono';
import { z } from 'zod';
import { Review } from '../../db/models/Review';
import { Product } from '../../db/models/Product';
import { requireAdmin } from '../../middleware/requireAdmin';
import type { AppEnv } from '../../types/hono';
import { escapeRegex, intFromInput, objectIdSchema, parseJson, parseParams, parseQuery, textField } from '../../lib/validation';
import { recomputeProductRating } from '../../lib/productRatings';

const reviewStatusSchema = z.enum(['pending', 'published', 'hidden']);

const listQuerySchema = z.object({
  status: reviewStatusSchema.optional(),
  rating: intFromInput(1, 5).optional(),
  search: textField(120).optional(),
  page: intFromInput(1, 10000).default(1),
  limit: intFromInput(1, 100).default(20),
});

const idParamsSchema = z.object({ id: objectIdSchema });

const updateStatusSchema = z.object({ status: reviewStatusSchema });

export const adminReviewsRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .get('/', async (c) => {
    const parsed = parseQuery(c, listQuerySchema);
    if (!parsed.success) return parsed.response;

    const { status, rating, search, page, limit } = parsed.data;
    // Reseñas creadas antes de que este campo existiera no tienen `status` guardado en Mongo -
    // el default del schema no se les aplica retroactivamente. Para no dejarlas invisibles bajo
    // el filtro "Publicada", se tratan como publicadas (= no ocultas), igual que en reviews.ts.
    const filter: Record<string, unknown> = status === 'published' ? { status: { $ne: 'hidden' } } : status ? { status } : {};
    if (rating) filter.rating = rating;

    if (search?.trim()) {
      const term = search.trim();
      const matchingProducts = await Product.find({ name: { $regex: escapeRegex(term), $options: 'i' } }).select('id').lean();
      const productIds = matchingProducts.map((product) => product.id);
      filter.$or = [
        { userName: { $regex: escapeRegex(term), $options: 'i' } },
        { title: { $regex: escapeRegex(term), $options: 'i' } },
        { body: { $regex: escapeRegex(term), $options: 'i' } },
        ...(productIds.length ? [{ productId: { $in: productIds } }] : []),
      ];
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Review.countDocuments(filter),
    ]);

    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await Product.find({ id: { $in: productIds } }).select('id name').lean();
    const nameById = new Map(products.map((product) => [product.id, product.name]));
    const enriched = items.map((item) => ({ ...item, productName: nameById.get(item.productId) || item.productId }));

    return c.json({ items: enriched, total, page, limit });
  })
  .patch('/:id', async (c) => {
    const paramsParsed = parseParams(c, idParamsSchema);
    if (!paramsParsed.success) return paramsParsed.response;

    const bodyParsed = await parseJson(c, updateStatusSchema);
    if (!bodyParsed.success) return bodyParsed.response;

    const review = await Review.findByIdAndUpdate(
      paramsParsed.data.id,
      { status: bodyParsed.data.status },
      { returnDocument: 'after' }
    ).lean();

    if (!review) return c.json({ error: 'Reseña no encontrada' }, 404);

    await recomputeProductRating(review.productId);
    return c.json(review);
  })
  .delete('/:id', async (c) => {
    const parsed = parseParams(c, idParamsSchema);
    if (!parsed.success) return parsed.response;

    const review = await Review.findByIdAndDelete(parsed.data.id).lean();
    if (!review) return c.json({ error: 'Reseña no encontrada' }, 404);

    await recomputeProductRating(review.productId);
    return c.json({ success: true });
  });
