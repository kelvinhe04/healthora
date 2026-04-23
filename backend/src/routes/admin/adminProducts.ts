import Elysia, { t } from 'elysia';
import { requireAdmin } from '../../middleware/requireAdmin';
import { Product } from '../../db/models/Product';

const ProductBody = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.String()),
  brand: t.Optional(t.String()),
  category: t.Optional(t.String()),
  need: t.Optional(t.String()),
  price: t.Optional(t.Number()),
  priceBefore: t.Optional(t.Number()),
  tag: t.Optional(t.String()),
  stock: t.Optional(t.Number()),
  imageUrl: t.Optional(t.String()),
  active: t.Optional(t.Boolean()),
});

export const adminProductsRouter = new Elysia({ prefix: '/admin/products' })
  .use(requireAdmin)
  .get('/', () => Product.find().lean())
  .post('/', async ({ body, set }) => {
    try {
      const p = await Product.create(body);
      set.status = 201;
      return p;
    } catch (e: unknown) {
      set.status = 400;
      return { error: e instanceof Error ? e.message : 'Error' };
    }
  }, { body: ProductBody })
  .put('/:id', async ({ params, body, set }) => {
    const p = await Product.findByIdAndUpdate(params.id, body, { new: true }).lean();
    if (!p) { set.status = 404; return { error: 'Not found' }; }
    return p;
  }, { body: ProductBody })
  .delete('/:id', async ({ params, set }) => {
    await Product.findByIdAndUpdate(params.id, { active: false });
    set.status = 204;
    return null;
  });
