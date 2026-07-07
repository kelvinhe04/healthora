import { Hono } from 'hono';
import { Category } from '../db/models/Category';
import { cacheGet, cacheSet } from '../lib/cache';

export const categoriesRouter = new Hono().get('/', async (c) => {
  const cacheKey = 'catalog:categories';
  const cached = await cacheGet<unknown[]>(cacheKey);
  if (cached && cached.length > 0) return c.json(cached);

  const categories = await Category.find().lean();
  if (categories.length > 0) await cacheSet(cacheKey, categories);
  return c.json(categories);
});
