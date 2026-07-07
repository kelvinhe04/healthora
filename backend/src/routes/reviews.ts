import { Hono } from 'hono';
import { z } from 'zod';
import { Review } from '../db/models/Review';
import { Product } from '../db/models/Product';
import { clerkAuth } from '../middleware/clerkAuth';
import type { AppEnv } from '../types/hono';
import {
  objectIdSchema,
  optionalTextField,
  parseJson,
  parseParams,
  parseQuery,
  productIdSchema,
  textField,
} from '../lib/validation';
import { cacheableJson } from '../lib/httpCache';

const reviewsQuerySchema = z.object({
  productId: productIdSchema,
});

const reviewCreateSchema = z.object({
  productId: productIdSchema,
  rating: z.coerce.number().int().min(1).max(5),
  title: optionalTextField(120),
  body: textField(2000),
});

const reviewIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const reviewsRouter = new Hono<AppEnv>()
  .get('/stats', async (c) => {
    const result = await Review.aggregate([
      { $group: { _id: null, total: { $sum: 1 }, avgRating: { $avg: '$rating' } } },
    ]);
    const { total = 0, avgRating = 0 } = result[0] ?? {};
    return cacheableJson(c, { total, avgRating: Math.round(avgRating * 10) / 10 }, 'reviewList');
  })
  .get('/', async (c) => {
    const parsed = parseQuery(c, reviewsQuerySchema);
    if (!parsed.success) return parsed.response;

    const reviews = await Review.find({ productId: parsed.data.productId }).sort({ createdAt: -1 }).lean();
    return cacheableJson(c, reviews, 'reviewList');
  })
  .post('/', clerkAuth, async (c) => {
    const user = c.get('user');
    const parsed = await parseJson(c, reviewCreateSchema);
    if (!parsed.success) return parsed.response;

    const { productId, rating, title, body } = parsed.data;
    const existing = await Review.findOne({ productId, userId: user.clerkId });
    if (existing) {
      return c.json({ error: 'Ya dejaste una resena para este producto' }, 409);
    }

    const review = await Review.create({
      productId,
      userId: user.clerkId,
      userName: user.name || 'Usuario',
      userAvatar: user.imageUrl,
      rating,
      title,
      body,
    });

    const allReviews = await Review.find({ productId }).lean();
    const newRating = allReviews.reduce((sum, reviewEntry) => sum + reviewEntry.rating, 0) / allReviews.length;
    await Product.updateOne(
      { id: productId },
      { rating: Math.round(newRating * 10) / 10, reviews: allReviews.length }
    );

    return c.json(review, 201);
  })
  .patch('/:id/helpful', clerkAuth, async (c) => {
    const parsed = parseParams(c, reviewIdParamsSchema);
    if (!parsed.success) return parsed.response;

    const { id } = parsed.data;
    const user = c.get('user');

    const review = await Review.findById(id).lean();
    if (!review) return c.json({ error: 'Resena no encontrada' }, 404);
    if (review.userId === user.clerkId) {
      return c.json({ error: 'No puedes votar tu propia resena' }, 403);
    }

    const updated = await Review.findByIdAndUpdate(
      id,
      { $addToSet: { helpfulVoters: user.clerkId } },
      { new: true }
    ).lean();
    return c.json(updated);
  });
