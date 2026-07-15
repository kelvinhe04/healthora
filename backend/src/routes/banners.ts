import { Hono } from 'hono';
import { Banner } from '../db/models/Banner';

export const bannersRouter = new Hono().get('/', async (c) => {
  const now = new Date();
  const banners = await Banner.find({
    active: true,
    $and: [
      { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
    ],
  })
    .sort({ order: 1, createdAt: 1 })
    .lean();

  return c.json(banners);
});
