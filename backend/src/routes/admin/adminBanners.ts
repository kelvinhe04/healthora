import { Hono } from 'hono';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAdmin';
import { auditAdminMutations } from '../../middleware/auditAdminAction';
import type { AppEnv } from '../../types/hono';
import { Banner } from '../../db/models/Banner';
import { intFromInput, objectIdSchema, optionalTextField, parseJson, parseParams, textField } from '../../lib/validation';

const bannerPayloadSchema = z.object({
  kicker: optionalTextField(120),
  title: textField(160),
  highlightWord: optionalTextField(60),
  description: optionalTextField(400),
  ctaText: textField(60),
  ctaHref: textField(300),
  backgroundColor: optionalTextField(40),
  imageUrl: optionalTextField(500),
  active: z.coerce.boolean().optional(),
  order: intFromInput(0, 999).optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
});

const bannerIdParamsSchema = z.object({ id: objectIdSchema });

export const adminBannersRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .use('*', auditAdminMutations('banners'))
  .get('/', async (c) => c.json(await Banner.find().sort({ order: 1, createdAt: 1 }).lean()))
  .post('/', async (c) => {
    const parsed = await parseJson(c, bannerPayloadSchema);
    if (!parsed.success) return parsed.response;

    const banner = await Banner.create(parsed.data);
    return c.json(banner, 201);
  })
  .put('/:id', async (c) => {
    const parsedParams = parseParams(c, bannerIdParamsSchema);
    if (!parsedParams.success) return parsedParams.response;

    const parsed = await parseJson(c, bannerPayloadSchema);
    if (!parsed.success) return parsed.response;

    const banner = await Banner.findByIdAndUpdate(parsedParams.data.id, { $set: parsed.data }, { returnDocument: 'after' }).lean();
    if (!banner) return c.json({ error: 'Banner no encontrado' }, 404);
    return c.json(banner);
  })
  .delete('/:id', async (c) => {
    const parsedParams = parseParams(c, bannerIdParamsSchema);
    if (!parsedParams.success) return parsedParams.response;

    const deleted = await Banner.findByIdAndDelete(parsedParams.data.id).lean();
    if (!deleted) return c.json({ error: 'Banner no encontrado' }, 404);
    return c.json({ ok: true, id: parsedParams.data.id });
  });
