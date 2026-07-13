import { Hono } from 'hono';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAdmin';
import { auditAdminMutations } from '../../middleware/auditAdminAction';
import type { AppEnv } from '../../types/hono';
import { Category } from '../../db/models/Category';
import {
  countProductsInCategory,
  listAdminCategories,
  reassignProductsCategory,
  upsertCategory,
} from '../../lib/categoryAdmin';
import { clearCatalogCache } from '../../lib/cache';
import { optionalTextField, parseJson, parseParams, productIdSchema, textField } from '../../lib/validation';

const categoryIdParamsSchema = z.object({
  id: productIdSchema,
});

const categoryPayloadSchema = z.object({
  id: productIdSchema,
  label: textField(120).optional(),
  sub: optionalTextField(160),
  color: optionalTextField(80),
  active: z.boolean().optional(),
  newId: productIdSchema.optional(),
});

const reassignPayloadSchema = z.object({
  toCategoryId: productIdSchema,
});

export const adminCategoriesRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .use('*', auditAdminMutations('categories'))
  .get('/', async (c) => c.json(await listAdminCategories()))
  .post('/', async (c) => {
    const parsed = await parseJson(c, categoryPayloadSchema);
    if (!parsed.success) return parsed.response;

    const { id, label, sub, color, active } = parsed.data;
    if (!label?.trim()) return c.json({ error: 'label es obligatorio al crear una categoría' }, 400);

    const exists = await Category.findOne({ id }).lean();
    if (exists) return c.json({ error: `Ya existe una categoría con id "${id}"` }, 409);

    try {
      const result = await upsertCategory({ id, label, sub, color, active });
      return c.json(result, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear categoría';
      return c.json({ error: message }, 400);
    }
  })
  .put('/:id', async (c) => {
    const parsedParams = parseParams(c, categoryIdParamsSchema);
    if (!parsedParams.success) return parsedParams.response;

    const parsed = await parseJson(
      c,
      categoryPayloadSchema.omit({ id: true }).extend({ newId: productIdSchema.optional() }),
    );
    if (!parsed.success) return parsed.response;

    const existing = await Category.findOne({ id: parsedParams.data.id }).lean();
    if (!existing) return c.json({ error: 'Categoría no encontrada' }, 404);

    try {
      const result = await upsertCategory({
        id: parsedParams.data.id,
        ...parsed.data,
      });
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar categoría';
      return c.json({ error: message }, 400);
    }
  })
  .patch('/:id/reassign-products', async (c) => {
    const parsedParams = parseParams(c, categoryIdParamsSchema);
    if (!parsedParams.success) return parsedParams.response;

    const parsed = await parseJson(c, reassignPayloadSchema);
    if (!parsed.success) return parsed.response;

    const fromId = parsedParams.data.id;
    const toId = parsed.data.toCategoryId;
    if (fromId === toId) return c.json({ error: 'La categoría destino debe ser distinta' }, 400);

    const target = await Category.findOne({ id: toId }).lean();
    if (!target) return c.json({ error: `Categoría destino "${toId}" no encontrada` }, 404);

    const productsReassigned = await reassignProductsCategory(fromId, toId);
    await clearCatalogCache();
    return c.json({ fromId, toId, productsReassigned });
  })
  .delete('/:id', async (c) => {
    const parsedParams = parseParams(c, categoryIdParamsSchema);
    if (!parsedParams.success) return parsedParams.response;

    const id = parsedParams.data.id;
    const reassignTo = c.req.query('reassignTo')?.trim();
    const productCount = await countProductsInCategory(id);

    if (productCount > 0) {
      if (!reassignTo) {
        return c.json(
          {
            error: `La categoría tiene ${productCount} producto${productCount !== 1 ? 's' : ''}. Indica reassignTo o reasígnalos antes de eliminar.`,
          },
          409,
        );
      }
      if (reassignTo === id) return c.json({ error: 'reassignTo debe ser otra categoría' }, 400);
      const target = await Category.findOne({ id: reassignTo }).lean();
      if (!target) return c.json({ error: `Categoría destino "${reassignTo}" no encontrada` }, 404);
      await reassignProductsCategory(id, reassignTo);
    }

    const deleted = await Category.deleteOne({ id });
    if (!deleted.deletedCount) return c.json({ error: 'Categoría no encontrada' }, 404);

    await clearCatalogCache();
    return c.json({ ok: true, id, productsReassigned: productCount });
  });
