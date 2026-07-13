import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { User } from '../db/models/User';
import { validatePromotionForCart } from '../lib/promotions';
import { emailField, optionalTextField, productIdSchema } from '../lib/validation';
import { errorResult, jsonResult } from '../toolHelpers';

export function registerPromotionTools(server: McpServer) {
  server.registerTool(
    'promotions.validateCoupon',
    {
      title: 'Validar cupón promocional',
      description:
        'Valida un código de descuento contra un carrito (productId, qty, variantId opcional) y devuelve el monto de descuento o el motivo de rechazo. Equivalente al campo de cupón del checkout (HU-040).',
      inputSchema: {
        code: optionalTextField(40),
        items: z.array(
          z.object({
            productId: productIdSchema,
            qty: z.coerce.number().int().min(1).max(99),
            variantId: optionalTextField(200),
          }),
        ).min(1).max(100),
        customerId: optionalTextField(180),
        email: emailField().optional(),
      },
    },
    async ({ code, items, customerId, email }) => {
      if (!code?.trim()) return errorResult('Debes indicar el código del cupón.');

      let resolvedCustomerId = customerId?.trim();
      if (!resolvedCustomerId && email) {
        const user = await User.findOne({ email: email.trim().toLowerCase() }).lean();
        resolvedCustomerId = user?.clerkId;
      }

      const result = await validatePromotionForCart(code, items, {
        customerId: resolvedCustomerId,
      });

      if (!result.valid) {
        return jsonResult({ valid: false, error: result.error, reason: result.reason });
      }

      return jsonResult({
        valid: true,
        code: result.code,
        label: result.label,
        discountAmount: result.discountAmount,
      });
    },
  );
}
