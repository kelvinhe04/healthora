import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { applyCategoryDiscount, isVigenciaRangeValid, removeCategoryDiscount } from '../../lib/discounts';
import { clearCatalogCache } from '../../lib/cache';
import { User } from '../../db/models/User';
import { validatePromotionForCart } from '../../lib/promotions';
import { emailField, moneyFromInput, optionalTextField, productIdSchema, textField } from '../../lib/validation';
import { errorResult, jsonResult } from '../toolHelpers';

const discountVigenciaMessage = { message: '"Vigente hasta" no puede ser anterior a "Vigente desde".', path: ['discountEndsAt'] };

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

  server.registerTool(
    'promotions.applyDiscount',
    {
      title: 'Aplicar o quitar descuento por categoría',
      description:
        'Aplica un descuento masivo a todos los productos activos de una categoría, o lo quita. Equivalente a "Descuento por categoría" en Productos del admin (HU-092).',
      inputSchema: {
        action: z.enum(['apply', 'remove']),
        category: textField(120),
        discountType: z.enum(['percent', 'fixed']).optional(),
        value: moneyFromInput(0.01, 999999).optional(),
        discountStartsAt: z.string().optional(),
        discountEndsAt: z.string().optional(),
      },
    },
    async ({ action, category, discountType, value, discountStartsAt, discountEndsAt }) => {
      if (!category?.trim()) return errorResult('Debes indicar la categoría.');

      if (action === 'remove') {
        const result = await removeCategoryDiscount(category.trim());
        await clearCatalogCache();
        return jsonResult(result);
      }

      if (!discountType || value == null) {
        return errorResult('Para aplicar un descuento indica discountType y value.');
      }
      if (discountType === 'percent' && value > 100) {
        return errorResult('El descuento porcentual no puede superar 100%.');
      }
      const startsAt = discountStartsAt ? new Date(discountStartsAt) : undefined;
      const endsAt = discountEndsAt ? new Date(discountEndsAt) : undefined;
      if (!isVigenciaRangeValid(startsAt, endsAt)) {
        return errorResult(discountVigenciaMessage.message);
      }

      const result = await applyCategoryDiscount({
        category: category.trim(),
        discountType,
        value,
        discountStartsAt: startsAt,
        discountEndsAt: endsAt,
      });
      await clearCatalogCache();
      return jsonResult(result);
    },
  );
}
