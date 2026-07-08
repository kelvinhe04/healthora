import { z } from 'zod';
import { moneyFromInput, optionalTextField, productIdSchema, textField } from '../lib/validation';

/** Mirrors `productVariantSchema` in routes/admin/adminProducts.ts - kept as a separate literal
 * copy (not imported) so MCP input validation doesn't silently change if the admin route's
 * schema evolves; both should be updated together when the variant shape changes. */
export const mcpVariantShape = z.object({
  id: productIdSchema,
  label: textField(160),
  type: z.enum(['size', 'color', 'weight', 'count', 'flavor', 'scent']),
  price: moneyFromInput(),
  stock: z.coerce.number().int().min(0).max(999999),
  sku: optionalTextField(120),
  color: optionalTextField(80),
  imageUrl: optionalTextField(400),
  images: z.array(textField(400)).max(20).optional(),
  imagesBySize: z.record(z.string(), z.array(textField(400)).max(20)).optional(),
  stockBySize: z.record(z.string(), z.coerce.number().int().min(0).max(999999)).optional(),
  priceBySize: z.record(z.string(), moneyFromInput()).optional(),
  isDefault: z.coerce.boolean().default(false),
  availableFor: z.array(productIdSchema).max(50).optional(),
});
