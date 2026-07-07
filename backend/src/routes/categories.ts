import { Hono } from 'hono';
import { Category } from '../db/models/Category';
import { cacheGet, cacheSet } from '../lib/cache';
import { cacheableJson } from '../lib/httpCache';

export const categoriesRouter = new Hono().get('/', async (c) => {
  const cacheKey = 'catalog:categories';
  const cached = await cacheGet<unknown[]>(cacheKey);
  if (cached && cached.length > 0) return cacheableJson(c, cached, 'catalogList');

  const categories = await Category.find().lean();
  if (categories.length > 0) await cacheSet(cacheKey, categories);
  return cacheableJson(c, categories, 'catalogList');
});
