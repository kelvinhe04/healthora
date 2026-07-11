import { Product } from '../db/models/Product';
import { getVariantCombos, hasTwoDimensions } from './productVariants';

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

/** The vigencia check shared by a product/variant's own `priceBefore` and a matrix combo's
 * `priceBeforeBySize` entry - both hide their "was $X" badge outside this window, on the primary
 * variant's `discountStartsAt`/`discountEndsAt` (a combo doesn't get its own date pair; every
 * combo of the same sabor/color shares its primary's vigencia). */
function isWithinVigencia(
  discountStartsAt: Date | string | null | undefined,
  discountEndsAt: Date | string | null | undefined,
  now: Date,
): boolean {
  if (discountStartsAt && now < panamaStartOfDay(discountStartsAt)) return false;
  if (discountEndsAt && now > panamaEndOfDay(discountEndsAt)) return false;
  return true;
}

export function isDiscountActive(product: DiscountableProduct, now: Date = new Date()): boolean {
  if (product.priceBefore == null) return false;
  return isWithinVigencia(product.discountStartsAt, product.discountEndsAt, now);
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
 * discount window — and to every sabor×tamaño matrix combo that carries a `priceBeforeBySize`
 * entry, gated on that same primary variant's vigencia dates.
 */
export function withEffectiveDiscount<
  T extends DiscountableProduct & { variants?: (DiscountableProduct & { priceBeforeBySize?: Record<string, number> })[] },
>(product: T, now: Date = new Date()): T {
  const withOwnDiscount: T =
    product.priceBefore == null || isDiscountActive(product, now) ? product : { ...product, priceBefore: undefined };

  if (!withOwnDiscount.variants?.length) return withOwnDiscount;

  let anyVariantChanged = false;
  const variants = withOwnDiscount.variants.map((variant) => {
    let next = variant;
    if (variant.priceBefore != null && !isDiscountActive(variant, now)) {
      next = { ...next, priceBefore: undefined };
      anyVariantChanged = true;
    }
    if (
      next.priceBeforeBySize &&
      Object.keys(next.priceBeforeBySize).length > 0 &&
      !isWithinVigencia(next.discountStartsAt, next.discountEndsAt, now)
    ) {
      next = { ...next, priceBeforeBySize: undefined };
      anyVariantChanged = true;
    }
    return next;
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
 * Applies a discount to every active product in a category, in one admin action. The discount
 * lands on each simple variant's own price when the product has (single-dimension) variants, on
 * each sabor×tamaño combo's price when it's a matrix product (respecting `availableFor`), or on
 * the product itself when it has neither - in every case using the option's own current price as
 * the base, so re-applying doesn't compound.
 */
export async function applyCategoryDiscount(
  input: CategoryDiscountInput,
): Promise<{ updated: number; total: number }> {
  const { category, discountType, value, discountStartsAt, discountEndsAt } = input;
  const products = await Product.find({ category, active: true });
  let updated = 0;

  for (const product of products) {
    let changed = false;

    if (hasTwoDimensions(product.variants)) {
      for (const { primary, size } of getVariantCombos(product.variants)) {
        // Same "don't compound on re-apply" rule as the simple-variant/product branches below:
        // prefer the combo's own prior `priceBeforeBySize` entry over its current (already
        // discounted) `priceBySize` override.
        const base = primary.priceBeforeBySize?.[size.id] ?? primary.priceBySize?.[size.id] ?? primary.price + size.price;
        const newPrice = discountedPrice(base, discountType, value);
        if (newPrice == null) continue;
        primary.priceBeforeBySize = { ...(primary.priceBeforeBySize ?? {}), [size.id]: base };
        primary.priceBySize = { ...(primary.priceBySize ?? {}), [size.id]: newPrice };
        primary.discountStartsAt = discountStartsAt;
        primary.discountEndsAt = discountEndsAt;
        changed = true;
      }
      if (changed) product.markModified('variants');
    } else if (product.variants?.length) {
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

  return { updated, total: products.length };
}

/** Reverts every discount in a category - the product-level one, any per-variant one, and any
 * per-combo one - back to the pre-discount price, regardless of whether it was set by
 * `applyCategoryDiscount`, the individual product/variant editor, or baked into the original seed
 * data. A combo that had no price override before the discount reverts to that same frozen number
 * rather than un-overriding back to a live `primary.price + size.price` sum - matching how
 * reverting a simple variant/product discount already restores an exact prior number instead of
 * trying to recompute one. */
export async function removeCategoryDiscount(category: string): Promise<{ updated: number }> {
  const products = await Product.find({
    category,
    $or: [
      { priceBefore: { $ne: null } },
      { 'variants.priceBefore': { $ne: null } },
      // Not `{ 'variants.priceBeforeBySize': { $ne: null } }`: Mongo's array-field `$ne` matches
      // only when NO element equals the excluded value, and a size variant (which never has this
      // field at all) counts as "null" for that purpose - so a real discount on the primary
      // variant would be masked by its sibling size variant simply lacking the field. `$elemMatch`
      // requires a single element to satisfy the condition, avoiding that trap.
      { variants: { $elemMatch: { priceBeforeBySize: { $exists: true } } } },
    ],
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
      if (variant.priceBefore != null) {
        variant.price = variant.priceBefore;
        variant.priceBefore = undefined;
        variant.discountStartsAt = undefined;
        variant.discountEndsAt = undefined;
        changed = true;
      }

      if (variant.priceBeforeBySize && Object.keys(variant.priceBeforeBySize).length > 0) {
        const priceBySize = { ...(variant.priceBySize ?? {}) };
        for (const [sizeId, before] of Object.entries(variant.priceBeforeBySize as Record<string, number>)) {
          priceBySize[sizeId] = before;
        }
        variant.priceBySize = priceBySize;
        variant.priceBeforeBySize = undefined;
        variant.discountStartsAt = undefined;
        variant.discountEndsAt = undefined;
        changed = true;
      }
    }

    if (!changed) continue;
    product.markModified('variants');
    await product.save();
    updated++;
  }

  return { updated };
}
