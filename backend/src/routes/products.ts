import Elysia, { t } from 'elysia';
import { Product } from '../db/models/Product';

export const productsRouter = new Elysia({ prefix: '/products' })
  .get('/', async ({ query }) => {
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

    return q.lean();
  }, {
    query: t.Object({
      category: t.Optional(t.String()),
      need: t.Optional(t.String()),
      brand: t.Optional(t.String()),
      priceMax: t.Optional(t.String()),
      sort: t.Optional(t.String()),
      inStock: t.Optional(t.String()),
      search: t.Optional(t.String()),
    }),
  })
  .get('/:id', async ({ params, set }) => {
    const p = await Product.findOne({ id: params.id, active: true }).lean();
    if (!p) { set.status = 404; return { error: 'Not found' }; }
    return p;
  });
