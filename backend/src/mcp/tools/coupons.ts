import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createCoupon } from '../../lib/coupons';
import { moneyFromInput, optionalTextField, textField } from '../../lib/validation';
import { errorResult, jsonResult } from '../toolHelpers';

const couponCreateSchema = z
  .object({
    code: textField(40),
    label: textField(120),
    discountType: z.enum(['percent', 'fixed']),
    percentOff: moneyFromInput(1, 100).optional(),
    amountOff: moneyFromInput(0.01, 999999).optional(),
    eligibleCategories: z.array(textField(120)).max(30).optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    active: z.coerce.boolean().optional().default(true),
    maxUses: z.coerce.number().int().min(1).max(999999).nullable().optional(),
    firstPurchaseOnly: z.coerce.boolean().optional().default(false),
  })
  .refine((body) => body.discountType !== 'percent' || body.percentOff != null, {
    message: 'percentOff es obligatorio para descuentos porcentuales.',
    path: ['percentOff'],
  })
  .refine((body) => body.discountType !== 'fixed' || body.amountOff != null, {
    message: 'amountOff es obligatorio para descuentos fijos.',
    path: ['amountOff'],
  });

export function registerCouponTools(server: McpServer) {
  server.registerTool(
    'coupons.createCoupon',
    {
      title: 'Crear cupón promocional',
      description:
        'Crea un cupón de descuento (porcentaje o monto fijo) con categorías elegibles, vigencia y límites de uso. Equivalente a la sección Cupones del admin.',
      inputSchema: {
        code: textField(40),
        label: textField(120),
        discountType: z.enum(['percent', 'fixed']),
        percentOff: moneyFromInput(1, 100).optional(),
        amountOff: moneyFromInput(0.01, 999999).optional(),
        eligibleCategories: z.array(textField(120)).max(30).optional(),
        expiresAt: z.string().nullable().optional(),
        active: z.coerce.boolean().optional(),
        maxUses: z.coerce.number().int().min(1).max(999999).nullable().optional(),
        firstPurchaseOnly: z.coerce.boolean().optional(),
      },
    },
    async (input) => {
      try {
        const parsed = couponCreateSchema.parse({
          ...input,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : input.expiresAt,
        });
        const coupon = await createCoupon(parsed);
        return jsonResult(coupon);
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'No se pudo crear el cupón.');
      }
    },
  );
}
