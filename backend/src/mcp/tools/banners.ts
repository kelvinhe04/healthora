import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Banner } from '../../db/models/Banner';
import { updateBannerSlot } from '../../lib/bannerAdmin';
import { optionalTextField, textField } from '../../lib/validation';
import { errorResult, jsonResult } from '../toolHelpers';

const bannerSlotSchema = z.enum(['promo', 'club']);

export function registerBannerTools(server: McpServer) {
  server.registerTool(
    'banners.updateBanner',
    {
      title: 'Editar uno de los 2 banners del landing',
      description:
        'Edita el banner "promo" (25% OFF, requiere categoryId - de ahí sale el link y las 2 fotos de producto) o "club" (Club Healthora) del landing. No crea banners nuevos: son exactamente esos 2 slots fijos. Equivalente a la sección Banners del admin (issue #265).',
      inputSchema: {
        slot: bannerSlotSchema,
        kicker: optionalTextField(120),
        title: textField(160),
        highlightWord: optionalTextField(60),
        description: optionalTextField(400),
        ctaText: textField(60),
        backgroundColor: optionalTextField(40),
        active: z.coerce.boolean().optional(),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
        categoryId: optionalTextField(120).describe('Obligatorio para slot "promo" (id de Category existente); ignorado para "club".'),
      },
    },
    async ({ slot, startDate, endDate, ...input }) => {
      try {
        const banner = await updateBannerSlot(slot, {
          ...input,
          startDate: startDate ? new Date(startDate) : startDate,
          endDate: endDate ? new Date(endDate) : endDate,
        });
        return jsonResult(banner);
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'No se pudo guardar el banner.');
      }
    },
  );

  server.registerTool(
    'banners.listBanners',
    {
      title: 'Listar los banners del landing',
      description: 'Lista los 2 banners fijos del landing (promo y club), activos e inactivos.',
      inputSchema: {},
    },
    async () => {
      const banners = await Banner.find().sort({ slot: 1 }).lean();
      return jsonResult({ count: banners.length, banners });
    },
  );
}
