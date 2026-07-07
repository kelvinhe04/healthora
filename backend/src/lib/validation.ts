import type { Context } from 'hono';
import { z, ZodError, type ZodType } from 'zod';

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: Response };

export function sanitizeText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim();
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function textField(max = 500, min = 1) {
  return z.string().transform(sanitizeText).pipe(z.string().min(min).max(max));
}

export function optionalTextField(max = 500) {
  return z
    .preprocess((value) => (value === null || value === undefined ? undefined : value), textField(max, 0).optional())
    .transform((value) => (value ? value : undefined));
}

export function emailField(max = 254) {
  return z
    .string()
    .transform((value) => sanitizeText(value).toLowerCase())
    .pipe(z.string().email('Email invalido').max(max));
}

export const objectIdSchema = z
  .string()
  .transform(sanitizeText)
  .pipe(z.string().regex(/^[a-f\d]{24}$/i, 'ID invalido'));

export const productIdSchema = z
  .string()
  .transform(sanitizeText)
  .pipe(z.string().min(1).max(180).regex(/^[a-zA-Z0-9._:-]+$/, 'ID de producto invalido'));

export const intFromInput = (min = 0, max = 9999) =>
  z.coerce.number().int().min(min).max(max);

export const moneyFromInput = (min = 0, max = 999999) =>
  z.coerce.number().finite().min(min).max(max);

export const addressSchema = z.object({
  name: textField(120),
  phone: textField(40),
  address: textField(240),
  city: textField(120),
  postal: textField(40),
});

export const savedAddressSchema = addressSchema.extend({
  label: optionalTextField(80).default(''),
  isDefault: z.coerce.boolean().default(false),
});

export const cartItemSchema = z.object({
  productId: productIdSchema,
  qty: intFromInput(1, 999),
  variantId: optionalTextField(180),
});

function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.length ? issue.path.join('.') : 'body',
    message: issue.message,
  }));
}

function invalidResponse(c: Context, error: ZodError, source: 'body' | 'query' | 'params') {
  return c.json(
    {
      error: `Entrada invalida en ${source}`,
      details: formatZodError(error),
    },
    400
  );
}

export async function parseJson<T>(c: Context, schema: ZodType<T>): Promise<ValidationResult<T>> {
  let payload: unknown;

  try {
    payload = await c.req.json();
  } catch {
    return { success: false, response: c.json({ error: 'JSON invalido' }, 400) };
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    return { success: false, response: invalidResponse(c, result.error, 'body') };
  }

  return { success: true, data: result.data };
}

export function parseQuery<T>(c: Context, schema: ZodType<T>): ValidationResult<T> {
  const result = schema.safeParse(c.req.query());
  if (!result.success) {
    return { success: false, response: invalidResponse(c, result.error, 'query') };
  }

  return { success: true, data: result.data };
}

export function parseParams<T>(c: Context, schema: ZodType<T>): ValidationResult<T> {
  const result = schema.safeParse(c.req.param());
  if (!result.success) {
    return { success: false, response: invalidResponse(c, result.error, 'params') };
  }

  return { success: true, data: result.data };
}
