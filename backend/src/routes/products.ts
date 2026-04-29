import { Hono } from 'hono';
import { Product } from '../db/models/Product';

export const productsRouter = new Hono()
  .get('/', async (c) => {
    const query = c.req.query();
    const filter: Record<string, unknown> = { active: true };
    if (query.category) filter.category = query.category;
    if (query.need) filter.need = query.need;
    if (query.brand) filter.brand = query.brand;
    if (query.inStock === '1') filter.stock = { $gt: 0 };
    if (query.priceMax) filter.price = { $lte: Number(query.priceMax) };
    if (query.search) filter.name = { $regex: query.search, $options: 'i' };

    let q = Product.find(filter);
    if (query.sort === 'price_asc') q = q.sort({ price: 1 });
    else if (query.sort === 'price_desc') q = q.sort({ price: -1 });
    else if (query.sort === 'rating') q = q.sort({ rating: -1 });
    else q = q.sort({ createdAt: -1 });

    const products = await q.lean();
    return c.json({ products, total: products.length });
  })
  .get('/count', async (c) => {
    const count = await Product.countDocuments({ active: true });
    return c.json({ count });
  })
  .get('/:id', async (c) => {
    const p = await Product.findOne({ id: c.req.param('id'), active: true }).lean();
    if (!p) return c.json({ error: 'Not found' }, 404);
    return c.json(p);
  });
