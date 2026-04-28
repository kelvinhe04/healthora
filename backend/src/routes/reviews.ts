import { Hono } from 'hono';
import { Review } from '../db/models/Review';
import { Product } from '../db/models/Product';
import { clerkAuth } from '../middleware/clerkAuth';
import type { AppEnv } from '../types/hono';

export const reviewsRouter = new Hono<AppEnv>()
  .get('/', async (c) => {
    const productId = c.req.query('productId');
    if (!productId) return c.json({ error: 'productId requerido' }, 400);
    const reviews = await Review.find({ productId }).sort({ createdAt: -1 }).lean();
    return c.json(reviews);
  })
  .post('/', clerkAuth, async (c) => {
    const user = c.get('user');
    const { productId, rating, title, body } = await c.req.json();

    if (!productId || !rating || !body?.trim()) {
      return c.json({ error: 'Faltan campos requeridos' }, 400);
    }
    if (rating < 1 || rating > 5) {
      return c.json({ error: 'La calificación debe ser entre 1 y 5' }, 400);
    }

    const existing = await Review.findOne({ productId, userId: user.clerkId });
    if (existing) {
      return c.json({ error: 'Ya dejaste una reseña para este producto' }, 409);
    }

    const review = await Review.create({
      productId,
      userId: user.clerkId,
      userName: user.name || 'Usuario',
      userAvatar: user.imageUrl,
      rating,
      title: title?.trim() || undefined,
      body: body.trim(),
    });

    // Sync product's aggregate rating + review count
    const allReviews = await Review.find({ productId }).lean();
    const newRating = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
    await Product.updateOne(
      { id: productId },
      { rating: Math.round(newRating * 10) / 10, reviews: allReviews.length }
    );

    return c.json(review, 201);
  })
  .patch('/:id/helpful', clerkAuth, async (c) => {
    const { id } = c.req.param();
    const user = c.get('user');

    const review = await Review.findById(id).lean();
    if (!review) return c.json({ error: 'Reseña no encontrada' }, 404);
    if (review.userId === user.clerkId) {
      return c.json({ error: 'No puedes votar tu propia reseña' }, 403);
    }

    const updated = await Review.findByIdAndUpdate(
      id,
      { $addToSet: { helpfulVoters: user.clerkId } },
      { new: true }
    ).lean();
    return c.json(updated);
  });
