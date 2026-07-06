import { Hono } from 'hono';
import { z } from 'zod';
import { Product } from '../db/models/Product';
import { escapeRegex, parseParams, parseQuery, productIdSchema, textField } from '../lib/validation';

const productQuerySchema = z.object({
  category: textField(120).optional(),
  need: textField(120).optional(),
  brand: textField(120).optional(),
  inStock: z.enum(['1']).optional(),
  priceMax: z.coerce.number().finite().min(0).max(999999).optional(),
  search: textField(120).optional(),
  sort: z.enum(['price_asc', 'price_desc', 'rating']).optional(),
});

const productParamsSchema = z.object({
  id: productIdSchema,
});

export const productsRouter = new Hono()
  .get('/', async (c) => {
    const parsed = parseQuery(c, productQuerySchema);
    if (!parsed.success) return parsed.response;

    const query = parsed.data;
    const filter: Record<string, unknown> = { active: true };
    if (query.category) filter.category = query.category;
    if (query.need) filter.need = query.need;
    if (query.brand) filter.brand = query.brand;
    if (query.inStock === '1') filter.stock = { $gt: 0 };
    if (query.priceMax !== undefined) filter.price = { $lte: query.priceMax };
    if (query.search) filter.name = { $regex: escapeRegex(query.search), $options: 'i' };

    let q = Product.find(filter);
    if (query.sort === 'price_asc') q = q.sort({ price: 1 });
    else if (query.sort === 'price_desc') q = q.sort({ price: -1 });
    else if (query.sort === 'rating') q = q.sort({ rating: -1 });
    else q = q.sort({ sortOrder: 1 });

    return c.json(await q.lean());
  })
  .get('/count', async (c) => {
    const count = await Product.countDocuments({ active: true });
    return c.json({ count });
  })
  .get('/:id', async (c) => {
    const parsed = parseParams(c, productParamsSchema);
    if (!parsed.success) return parsed.response;

    const p = await Product.findOne({ id: parsed.data.id, active: true }).lean();
    if (!p) return c.json({ error: 'Not found' }, 404);
    return c.json(p);
  });
