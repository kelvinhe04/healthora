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
 * the product itself when it has neither.
 *
 * The base to discount from depends on whether this same tool already owns the item's current
 * discount: re-applying (item already stamped `categoryDiscount: true`) discounts from the frozen
 * pre-bulk price captured in its `categoryDiscountRestore(BySize)` snapshot, so repeated clicks
 * don't compound. The *first* time this tool touches an item, it discounts from its current
 * `price` - which, for an item an admin already discounted by hand on its own editor, is that
 * hand-set sale price, not the "before" figure above it - and captures a snapshot of exactly what
 * that hand-set state was (price, priceBefore, vigencia) so `removeCategoryDiscount` can restore
 * it verbatim later, instead of just stripping every discount down to nothing.
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
      // Cache each primary's pre-apply `categoryDiscount` state once - it flips to `true` mid-loop
      // as soon as its first combo is processed, and every later combo of that same primary must
      // still see the *original* value to know whether it, specifically, is being swept for the
      // first time (otherwise a second combo would wrongly skip capturing its own restore snapshot).
      const primaryWasBulk = new Map<string, boolean>();
      for (const { primary, size } of getVariantCombos(product.variants)) {
        if (!primaryWasBulk.has(primary.id)) primaryWasBulk.set(primary.id, primary.categoryDiscount === true);
        const alreadyBulk = primaryWasBulk.get(primary.id)!;

        const priorPrice = primary.priceBySize?.[size.id] ?? primary.price + size.price;
        const priorBefore = primary.priceBeforeBySize?.[size.id];
        const restored = alreadyBulk ? primary.categoryDiscountRestoreBySize?.[size.id] : undefined;
        const base = restored?.price ?? priorPrice;
        const newPrice = discountedPrice(base, discountType, value);
        if (newPrice == null) continue;

        if (!alreadyBulk) {
          primary.categoryDiscountRestoreBySize = {
            ...(primary.categoryDiscountRestoreBySize ?? {}),
            [size.id]: { price: priorPrice, ...(priorBefore != null ? { priceBefore: priorBefore } : {}) },
          };
        }
        primary.priceBeforeBySize = { ...(primary.priceBeforeBySize ?? {}), [size.id]: base };
        primary.priceBySize = { ...(primary.priceBySize ?? {}), [size.id]: newPrice };
        primary.discountStartsAt = discountStartsAt;
        primary.discountEndsAt = discountEndsAt;
        primary.categoryDiscount = true;
        changed = true;
      }
      if (changed) product.markModified('variants');
    } else if (product.variants?.length) {
      for (const variant of product.variants) {
        const alreadyBulk = variant.categoryDiscount === true;
        const restored = alreadyBulk ? variant.categoryDiscountRestore : undefined;
        const base = restored?.price ?? variant.price;
        const newPrice = discountedPrice(base, discountType, value);
        if (newPrice == null) continue;

        if (!alreadyBulk) {
          variant.categoryDiscountRestore = {
            price: variant.price,
            ...(variant.priceBefore != null ? { priceBefore: variant.priceBefore } : {}),
            ...(variant.discountStartsAt ? { discountStartsAt: variant.discountStartsAt } : {}),
            ...(variant.discountEndsAt ? { discountEndsAt: variant.discountEndsAt } : {}),
          };
        }
        variant.priceBefore = base;
        variant.price = newPrice;
        variant.discountStartsAt = discountStartsAt;
        variant.discountEndsAt = discountEndsAt;
        variant.categoryDiscount = true;
        changed = true;
      }
    } else {
      const alreadyBulk = product.categoryDiscount === true;
      const restored = alreadyBulk ? product.categoryDiscountRestore : undefined;
      const base = restored?.price ?? product.price;
      const newPrice = discountedPrice(base, discountType, value);
      if (newPrice != null) {
        if (!alreadyBulk) {
          product.categoryDiscountRestore = {
            price: product.price,
            ...(product.priceBefore != null ? { priceBefore: product.priceBefore } : {}),
            ...(product.discountStartsAt ? { discountStartsAt: product.discountStartsAt } : {}),
            ...(product.discountEndsAt ? { discountEndsAt: product.discountEndsAt } : {}),
          };
        }
        product.priceBefore = base;
        product.price = newPrice;
        product.discountStartsAt = discountStartsAt;
        product.discountEndsAt = discountEndsAt;
        product.categoryDiscount = true;
        changed = true;
      }
    }

    if (!changed) continue;
    await product.save();
    updated++;
  }

  return { updated, total: products.length };
}

/** Reverts every discount this same tool applied in a category - the product-level one, any
 * per-variant one, and any per-combo one. Only touches items stamped `categoryDiscount: true` by
 * `applyCategoryDiscount`; a discount an admin set by hand on one product's own editor (or one
 * baked into the original seed data) is never marked that way, so it survives a category-wide
 * "quitar descuento" untouched.
 *
 * Restores from the `categoryDiscountRestore(BySize)` snapshot captured at apply time when one
 * exists - putting back the *exact* prior state (price and, if there was one, its own hand-set
 * priceBefore/vigencia) rather than just stripping the item down to no discount at all. Falls back
 * to the old "just un-freeze priceBefore into price" behavior for data written before this
 * snapshot existed (e.g. by an older build of this tool). */
export async function removeCategoryDiscount(category: string): Promise<{ updated: number }> {
  const products = await Product.find({
    category,
    $or: [{ categoryDiscount: true }, { 'variants.categoryDiscount': true }],
  });
  let updated = 0;

  for (const product of products) {
    let changed = false;

    if (product.categoryDiscount) {
      const restore = product.categoryDiscountRestore;
      if (restore) {
        product.price = restore.price;
        product.priceBefore = restore.priceBefore;
        product.discountStartsAt = restore.discountStartsAt;
        product.discountEndsAt = restore.discountEndsAt;
      } else if (product.priceBefore != null) {
        product.price = product.priceBefore;
        product.priceBefore = undefined;
        product.discountStartsAt = undefined;
        product.discountEndsAt = undefined;
      }
      product.categoryDiscount = undefined;
      product.categoryDiscountRestore = undefined;
      changed = true;
    }

    for (const variant of product.variants ?? []) {
      if (!variant.categoryDiscount) continue;

      if (variant.priceBeforeBySize && Object.keys(variant.priceBeforeBySize).length > 0) {
        const comboRestore = variant.categoryDiscountRestoreBySize;
        const priceBySize = { ...(variant.priceBySize ?? {}) };
        const priceBeforeBySize: Record<string, number> = {};
        for (const [sizeId, before] of Object.entries(variant.priceBeforeBySize as Record<string, number>)) {
          const snap = comboRestore?.[sizeId];
          priceBySize[sizeId] = snap?.price ?? before;
          if (snap?.priceBefore != null) priceBeforeBySize[sizeId] = snap.priceBefore;
        }
        variant.priceBySize = priceBySize;
        variant.priceBeforeBySize = Object.keys(priceBeforeBySize).length ? priceBeforeBySize : undefined;
        variant.discountStartsAt = undefined;
        variant.discountEndsAt = undefined;
      } else if (variant.priceBefore != null) {
        const restore = variant.categoryDiscountRestore;
        if (restore) {
          variant.price = restore.price;
          variant.priceBefore = restore.priceBefore;
          variant.discountStartsAt = restore.discountStartsAt;
          variant.discountEndsAt = restore.discountEndsAt;
        } else {
          variant.price = variant.priceBefore;
          variant.priceBefore = undefined;
          variant.discountStartsAt = undefined;
          variant.discountEndsAt = undefined;
        }
      }

      variant.categoryDiscount = undefined;
      variant.categoryDiscountRestore = undefined;
      variant.categoryDiscountRestoreBySize = undefined;
      changed = true;
    }

    if (!changed) continue;
    product.markModified('variants');
    await product.save();
    updated++;
  }

  return { updated };
}
