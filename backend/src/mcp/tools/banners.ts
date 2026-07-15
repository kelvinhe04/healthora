import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Banner } from '../../db/models/Banner';
import { intFromInput, objectIdSchema, optionalTextField, textField } from '../../lib/validation';
import { errorResult, jsonResult } from '../toolHelpers';

const bannerFieldsSchema = {
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
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
};

export function registerBannerTools(server: McpServer) {
  server.registerTool(
    'banners.upsertBanner',
    {
      title: 'Crear o actualizar banner promocional',
      description:
        'Crea un banner nuevo o, si se pasa id, actualiza uno existente (titulo, CTA, color/imagen de fondo, vigencia, activo/orden). Equivalente a la sección Banners del admin (issue #265).',
      inputSchema: {
        id: objectIdSchema.optional(),
        ...bannerFieldsSchema,
      },
    },
    async ({ id, ...input }) => {
      try {
        const parsed = z.object(bannerFieldsSchema).parse(input);
        const data = {
          ...parsed,
          startDate: parsed.startDate ? new Date(parsed.startDate) : parsed.startDate,
          endDate: parsed.endDate ? new Date(parsed.endDate) : parsed.endDate,
        };

        if (id) {
          const banner = await Banner.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after' }).lean();
          if (!banner) return errorResult(`No se encontró ningún banner con id "${id}".`);
          return jsonResult(banner);
        }

        const banner = await Banner.create(data);
        return jsonResult(banner);
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'No se pudo guardar el banner.');
      }
    },
  );

  server.registerTool(
    'banners.listBanners',
    {
      title: 'Listar banners promocionales',
      description: 'Lista todos los banners del admin (activos e inactivos), en el orden de despliegue.',
      inputSchema: {},
    },
    async () => {
      const banners = await Banner.find().sort({ order: 1, createdAt: 1 }).lean();
      return jsonResult({ count: banners.length, banners });
    },
  );
}
