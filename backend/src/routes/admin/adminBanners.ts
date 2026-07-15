import { Hono } from 'hono';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAdmin';
import { auditAdminMutations } from '../../middleware/auditAdminAction';
import type { AppEnv } from '../../types/hono';
import { Banner } from '../../db/models/Banner';
import { updateBannerSlot } from '../../lib/bannerAdmin';
import { optionalTextField, parseJson, parseParams, textField } from '../../lib/validation';

const bannerSlotSchema = z.enum(['promo', 'club']);

const bannerPayloadSchema = z.object({
  kicker: optionalTextField(120),
  title: textField(160),
  highlightWord: optionalTextField(60),
  description: optionalTextField(400),
  ctaText: textField(60),
  backgroundColor: optionalTextField(40),
  active: z.coerce.boolean().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  categoryId: optionalTextField(120),
});

const bannerSlotParamsSchema = z.object({ slot: bannerSlotSchema });

export const adminBannersRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .use('*', auditAdminMutations('banners'))
  .get('/', async (c) => c.json(await Banner.find().sort({ slot: 1 }).lean()))
  .put('/:slot', async (c) => {
    const parsedParams = parseParams(c, bannerSlotParamsSchema);
    if (!parsedParams.success) return parsedParams.response;

    const parsed = await parseJson(c, bannerPayloadSchema);
    if (!parsed.success) return parsed.response;

    try {
      const banner = await updateBannerSlot(parsedParams.data.slot, parsed.data);
      return c.json(banner);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar el banner';
      return c.json({ error: message }, 400);
    }
  });
