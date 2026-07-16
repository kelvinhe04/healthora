import { Hono } from 'hono';
import { Banner } from '../db/models/Banner';

export const bannersRouter = new Hono().get('/', async (c) => {
  const now = new Date();
  const banners = await Banner.find({
    $and: [
      { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
    ],
  }).lean();

  const promo = banners.find((b) => b.slot === 'promo') ?? null;
  const club = banners.find((b) => b.slot === 'club') ?? null;
  return c.json({ promo, club });
});
