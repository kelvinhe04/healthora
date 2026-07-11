import { Hono } from 'hono';
import { z } from 'zod';
import { Review } from '../db/models/Review';
import { ReviewBan } from '../db/models/ReviewBan';
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
import { notifyAdmins } from '../lib/realtime';

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
      { $match: { status: { $ne: 'hidden' } } },
      { $group: { _id: null, total: { $sum: 1 }, avgRating: { $avg: '$rating' } } },
    ]);
    const { total = 0, avgRating = 0 } = result[0] ?? {};
    return cacheableJson(c, { total, avgRating: Math.round(avgRating * 10) / 10 }, 'reviewList');
  })
  // Per-product rating averages in a single query - used by the admin products table so it
  // doesn't need one /reviews request per row (N+1) just to render/sort a rating column.
  .get('/summary', async (c) => {
    const result = await Review.aggregate([
      { $match: { status: { $ne: 'hidden' } } },
      { $group: { _id: '$productId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    const summary = Object.fromEntries(
      result.map((entry) => [entry._id, { avgRating: Math.round(entry.avgRating * 10) / 10, count: entry.count }]),
    );
    return cacheableJson(c, summary, 'reviewList');
  })
  .get('/', async (c) => {
    const parsed = parseQuery(c, reviewsQuerySchema);
    if (!parsed.success) return parsed.response;

    const reviews = await Review.find({ productId: parsed.data.productId, status: { $ne: 'hidden' } }).sort({ createdAt: -1 }).lean();
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

    const banned = await ReviewBan.findOne({ productId, userId: user.clerkId }).lean();
    if (banned) {
      return c.json({ error: 'Un administrador restringió tu cuenta para dejar reseñas en este producto' }, 403);
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

    const allReviews = await Review.find({ productId, status: { $ne: 'hidden' } }).lean();
    const newRating = allReviews.reduce((sum, reviewEntry) => sum + reviewEntry.rating, 0) / allReviews.length;
    const product = await Product.findOneAndUpdate(
      { id: productId },
      { rating: Math.round(newRating * 10) / 10, reviews: allReviews.length },
      { returnDocument: 'after' }
    ).lean();

    // Real-time alert to admins (HU-061). Best-effort - a notification failure must not fail the
    // review creation itself.
    try {
      await notifyAdmins({
        type: 'new_review',
        title: 'Nueva reseña',
        body: `${user.name || 'Un cliente'} dejó ${rating}★ en "${product?.name || productId}".`,
        link: `/product/${productId}`,
        data: { productId, reviewId: review._id.toString(), rating },
      });
    } catch (notifyError) {
      console.error('[REVIEWS] Failed to push new_review notification:', notifyError);
    }

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
