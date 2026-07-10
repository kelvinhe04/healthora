import { Product } from '../db/models/Product';
import { hasTwoDimensions } from './productVariants';

export interface DiscountableProduct {
  price: number;
  priceBefore?: number | null;
  discountStartsAt?: Date | string | null;
  discountEndsAt?: Date | string | null;
}

// America/Panama has no DST, so it's always a fixed UTC-5 offset - no Intl/timezone-db lookup
// needed, just a constant shift (same reasoning `lib/dates.ts` already relies on for display).
const PANAMA_UTC_OFFSET_MS = 5 * 60 * 60 * 1000;

/** A date-only vigencia bound (from a `type="date"` input, e.g. "2026-07-10") names a calendar
 * day in America/Panama, not UTC. `new Date("2026-07-10")` parses as 2026-07-10T00:00:00Z, which
 * is 2026-07-09T19:00 in Panama - almost a full day *before* the admin's intended start of that
 * day. Shifting by the fixed Panama offset recovers the correct UTC instant for "midnight, Panama
 * time" on that calendar day. */
function panamaStartOfDay(dateOnly: Date | string): Date {
  return new Date(new Date(dateOnly).getTime() + PANAMA_UTC_OFFSET_MS);
}

/** End of that same Panama calendar day (23:59:59.999 Panama time), as a UTC instant - so a
 * discount configured "through July 10" stays active for the *entire* July 10 in Panama, not
 * just its first instant. */
function panamaEndOfDay(dateOnly: Date | string): Date {
  return new Date(panamaStartOfDay(dateOnly).getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function isDiscountActive(product: DiscountableProduct, now: Date = new Date()): boolean {
  if (product.priceBefore == null) return false;
  if (product.discountStartsAt && now < panamaStartOfDay(product.discountStartsAt)) return false;
  if (product.discountEndsAt && now > panamaEndOfDay(product.discountEndsAt)) return false;
  return true;
}

/** An end date before the start date creates a window that can never be active (no "now" is ever
 * both >= start and <= end) - silently useless rather than a validation error, so callers must
 * reject it upfront. `true` when either bound is missing, since a one-sided window is always
 * well-formed. */
export function isVigenciaRangeValid(startsAt?: Date | string | null, endsAt?: Date | string | null): boolean {
  if (!startsAt || !endsAt) return true;
  return new Date(endsAt) >= new Date(startsAt);
}

/**
 * Returns the product as it should be displayed right now: `price` is always the real, current
 * selling price (it's what the admin explicitly set and what checkout always charges - it never
 * auto-changes). Outside the discount's validity window, only `priceBefore` (and the vigencia
 * dates) are hidden, so the "was $X" strikethrough/badge stops showing without a background job -
 * but the actual price is untouched either way.
 *
 * Also applies the same badge-hiding, independently, to every "simple" (single-dimension) variant
 * that carries its own priceBefore/vigencia — a product and its variants can each have their own
 * discount window. Sabor×tamaño matrix combos are out of scope (see `resolveVariantPricing`);
 * those never get a `priceBefore` written by the admin discount features, so this is a no-op for
 * them regardless.
 */
export function withEffectiveDiscount<T extends DiscountableProduct & { variants?: DiscountableProduct[] }>(
  product: T,
  now: Date = new Date(),
): T {
  const withOwnDiscount: T =
    product.priceBefore == null || isDiscountActive(product, now) ? product : { ...product, priceBefore: undefined };

  if (!withOwnDiscount.variants?.length) return withOwnDiscount;

  let anyVariantChanged = false;
  const variants = withOwnDiscount.variants.map((variant) => {
    if (variant.priceBefore == null || isDiscountActive(variant, now)) return variant;
    anyVariantChanged = true;
    return { ...variant, priceBefore: undefined };
  });

  return anyVariantChanged ? { ...withOwnDiscount, variants } : withOwnDiscount;
}

/** Applies a percent/fixed discount to a base price, floored at $0.01. Returns null when the
 * result wouldn't actually be a discount (e.g. a fixed amount larger than the base price already
 * clamped down to it) so the caller can skip writing a no-op priceBefore. */
export function discountedPrice(base: number, discountType: 'percent' | 'fixed', value: number): number | null {
  const raw = discountType === 'percent' ? base * (1 - value / 100) : base - value;
  const rounded = Math.round(Math.max(0.01, raw) * 100) / 100;
  return rounded < base ? rounded : null;
}

export interface CategoryDiscountInput {
  category: string;
  discountType: 'percent' | 'fixed';
  value: number;
  discountStartsAt?: Date;
  discountEndsAt?: Date;
}

/**
 * Applies a discount to every active product in a category, in one admin action. Sabor×tamaño
 * matrix products are skipped (see `withEffectiveDiscount`'s doc comment) - counted separately so
 * the admin isn't told "updated" for products that visibly didn't change. For everything else,
 * the discount lands on each simple variant's own price when the product has variants (using each
 * variant's own current price as the base, so re-applying doesn't compound), or on the product
 * itself when it has none.
 */
export async function applyCategoryDiscount(
  input: CategoryDiscountInput,
): Promise<{ updated: number; total: number; skippedMatrix: number }> {
  const { category, discountType, value, discountStartsAt, discountEndsAt } = input;
  const products = await Product.find({ category, active: true });
  let updated = 0;
  let skippedMatrix = 0;

  for (const product of products) {
    if (hasTwoDimensions(product.variants)) {
      skippedMatrix++;
      continue;
    }

    let changed = false;

    if (product.variants?.length) {
      for (const variant of product.variants) {
        const base = variant.priceBefore ?? variant.price;
        const newPrice = discountedPrice(base, discountType, value);
        if (newPrice == null) continue;
        variant.priceBefore = base;
        variant.price = newPrice;
        variant.discountStartsAt = discountStartsAt;
        variant.discountEndsAt = discountEndsAt;
        changed = true;
      }
    } else {
      const base = product.priceBefore ?? product.price;
      const newPrice = discountedPrice(base, discountType, value);
      if (newPrice != null) {
        product.priceBefore = base;
        product.price = newPrice;
        product.discountStartsAt = discountStartsAt;
        product.discountEndsAt = discountEndsAt;
        changed = true;
      }
    }

    if (!changed) continue;
    await product.save();
    updated++;
  }

  return { updated, total: products.length, skippedMatrix };
}

/** Reverts every discount in a category - both the product-level one and any per-variant one -
 * back to the pre-discount price, regardless of whether it was set by `applyCategoryDiscount`,
 * the individual product/variant editor, or baked into the original seed data. */
export async function removeCategoryDiscount(category: string): Promise<{ updated: number }> {
  const products = await Product.find({
    category,
    $or: [{ priceBefore: { $ne: null } }, { 'variants.priceBefore': { $ne: null } }],
  });
  let updated = 0;

  for (const product of products) {
    let changed = false;

    if (product.priceBefore != null) {
      product.price = product.priceBefore;
      product.priceBefore = undefined;
      product.discountStartsAt = undefined;
      product.discountEndsAt = undefined;
      changed = true;
    }

    for (const variant of product.variants ?? []) {
      if (variant.priceBefore == null) continue;
      variant.price = variant.priceBefore;
      variant.priceBefore = undefined;
      variant.discountStartsAt = undefined;
      variant.discountEndsAt = undefined;
      changed = true;
    }

    if (!changed) continue;
    await product.save();
    updated++;
  }

  return { updated };
}
