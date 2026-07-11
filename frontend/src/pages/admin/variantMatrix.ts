import type { ProductVariant } from '../../types';
import { PRIMARY_VARIANT_TYPES } from '../../lib/productVariants';
import { slugify } from './utils';

/** Any variant type that can play the "primary" role in a primary x size matrix (everything but size). */
export type PrimaryVariantType = Exclude<ProductVariant['type'], 'size'>;

export const PRIMARY_TYPE_LABELS: Record<PrimaryVariantType, { singular: string; plural: string }> = {
  flavor: { singular: 'Sabor', plural: 'Sabores' },
  scent: { singular: 'Aroma', plural: 'Aromas' },
  color: { singular: 'Color', plural: 'Colores' },
  weight: { singular: 'Peso', plural: 'Pesos' },
  count: { singular: 'Conteo', plural: 'Conteos' },
};

/** Which of the three "tipo de producto" pills is effectively active, derived from the form state
 * rather than stored — picking "Sin variante" clears the simple rows, so an empty simple list
 * always reads back as "none" even if `mode` is technically still 'simple'. */
export type VariantTab = 'none' | 'simple' | 'matrix';

export function getVariantTab(mode: 'simple' | 'matrix', simpleRowCount: number): VariantTab {
  if (mode === 'matrix') return 'matrix';
  return simpleRowCount === 0 ? 'none' : 'simple';
}

export type MatrixPrimaryRow = {
  /** Stable identity for React lists and cell lookups; independent of the editable `id`. */
  key: string;
  id: string;
  label: string;
  price: string;
  stock: string;
  sku: string;
  isDefault: boolean;
  images: string[];
  /** Only meaningful when primaryType === 'color'. */
  color: string;
  /** Vigencia for this primary's combo discounts (see `MatrixCell.priceBefore`). No dedicated
   * editor yet - carried through so a category discount applied via the bulk admin tool survives
   * an unrelated manual re-save of this product instead of being silently dropped. */
  discountStartsAt: string;
  discountEndsAt: string;
};

export type MatrixSizeRow = {
  key: string;
  id: string;
  label: string;
  price: string;
  stock: string;
  sku: string;
  isDefault: boolean;
};

export type MatrixCell = {
  active: boolean;
  /** Combo-specific stock override; empty string means "use the size's shared stock". */
  stock: string;
  /** Combo-specific price override; empty string means "use the tamaño's base price". */
  price: string;
  /** Combo-specific "was $X" price, set by a category discount; empty string means no discount
   * on this combo. No dedicated editor yet - see `MatrixPrimaryRow.discountStartsAt`. */
  priceBefore: string;
  /** Combo-specific images; ignored unless `imagesTouched` is true. */
  images: string[];
  /** True once the user has edited this combo's own image picker (add or remove) - distinguishes
   * "explicitly cleared to zero images" from "never touched, fall back to the sabor's images".
   * Without this flag an empty `images` array is indistinguishable from "untouched", so removing
   * the last image would immediately snap back to showing the sabor's 4 default photos. */
  imagesTouched: boolean;
};

export type MatrixState = {
  primaryType: PrimaryVariantType;
  primary: MatrixPrimaryRow[];
  sizes: MatrixSizeRow[];
  cells: Record<string, MatrixCell>;
};

function newKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function cellKey(primaryKey: string, sizeKey: string): string {
  return `${primaryKey}:${sizeKey}`;
}

export function emptyPrimaryRow(): MatrixPrimaryRow {
  return { key: newKey(), id: '', label: '', price: '0', stock: '0', sku: '', isDefault: false, images: [], color: '', discountStartsAt: '', discountEndsAt: '' };
}

export function emptySizeRow(): MatrixSizeRow {
  return { key: newKey(), id: '', label: '', price: '0', stock: '0', sku: '', isDefault: false };
}

export function emptyMatrixCell(): MatrixCell {
  return { active: true, stock: '', price: '', priceBefore: '', images: [], imagesTouched: false };
}

export function emptyMatrixState(): MatrixState {
  return { primaryType: 'flavor', primary: [], sizes: [], cells: {} };
}

export function decomposeToMatrix(variants: ProductVariant[]): MatrixState {
  const primaryVariants = variants.filter((v) => PRIMARY_VARIANT_TYPES.includes(v.type));
  const sizeVariants = variants.filter((v) => v.type === 'size');
  const primaryType = (primaryVariants[0]?.type as PrimaryVariantType) ?? 'flavor';

  const primary: MatrixPrimaryRow[] = primaryVariants.map((v) => ({
    key: v.id,
    id: v.id,
    label: v.label,
    price: String(v.price),
    stock: String(v.stock),
    sku: v.sku ?? '',
    isDefault: Boolean(v.isDefault),
    images: v.images?.length ? v.images : v.imageUrl ? [v.imageUrl] : [],
    color: v.color ?? '',
    discountStartsAt: v.discountStartsAt ? v.discountStartsAt.slice(0, 10) : '',
    discountEndsAt: v.discountEndsAt ? v.discountEndsAt.slice(0, 10) : '',
  }));

  const sizes: MatrixSizeRow[] = sizeVariants.map((v) => ({
    key: v.id,
    id: v.id,
    label: v.label,
    price: String(v.price),
    stock: String(v.stock),
    sku: v.sku ?? '',
    isDefault: Boolean(v.isDefault),
  }));

  const cells: Record<string, MatrixCell> = {};
  for (const p of primaryVariants) {
    for (const s of sizeVariants) {
      // Same undefined-vs-empty-array distinction as `sizesFor`: missing `availableFor` means
      // "active for everyone", an empty array means "active for no one" - not the same thing.
      const active = !s.availableFor || s.availableFor.includes(p.id);
      if (!active) continue;
      cells[cellKey(p.id, s.id)] = {
        active: true,
        stock: p.stockBySize?.[s.id] != null ? String(p.stockBySize[s.id]) : '',
        price: p.priceBySize?.[s.id] != null ? String(p.priceBySize[s.id]) : '',
        priceBefore: p.priceBeforeBySize?.[s.id] != null ? String(p.priceBeforeBySize[s.id]) : '',
        images: p.imagesBySize?.[s.id] ?? [],
        imagesTouched: p.imagesBySize?.[s.id] != null,
      };
    }
  }

  return { primaryType, primary, sizes, cells };
}

export function composeFromMatrix(state: MatrixState): ProductVariant[] {
  const { primaryType, primary, sizes, cells } = state;
  const usedIds = new Set<string>();

  function resolveId(label: string, existingId: string): string {
    if (existingId.trim()) {
      const id = existingId.trim();
      usedIds.add(id);
      return id;
    }
    let id = slugify(label) || `variant-${usedIds.size + 1}`;
    while (usedIds.has(id)) id = `${id}-${usedIds.size + 1}`;
    usedIds.add(id);
    return id;
  }

  const primaryIdByKey = new Map<string, string>();
  for (const p of primary) primaryIdByKey.set(p.key, resolveId(p.label, p.id));

  const sizeIdByKey = new Map<string, string>();
  for (const s of sizes) sizeIdByKey.set(s.key, resolveId(s.label, s.id));

  const primaryVariants: ProductVariant[] = primary
    .filter((p) => p.label.trim())
    .map((p) => {
      const id = primaryIdByKey.get(p.key)!;
      const imagesBySize: Record<string, string[]> = {};
      const stockBySize: Record<string, number> = {};
      const priceBySize: Record<string, number> = {};
      const priceBeforeBySize: Record<string, number> = {};
      for (const s of sizes) {
        const cell = cells[cellKey(p.key, s.key)];
        if (!cell?.active) continue;
        const sizeId = sizeIdByKey.get(s.key)!;
        if (cell.imagesTouched) imagesBySize[sizeId] = cell.images;
        if (cell.stock.trim() !== '') stockBySize[sizeId] = parseInt(cell.stock, 10) || 0;
        if (cell.price.trim() !== '') priceBySize[sizeId] = parseFloat(cell.price) || 0;
        if (cell.priceBefore.trim() !== '') priceBeforeBySize[sizeId] = parseFloat(cell.priceBefore) || 0;
      }
      return {
        id,
        label: p.label.trim(),
        type: primaryType,
        price: parseFloat(p.price) || 0,
        stock: parseInt(p.stock, 10) || 0,
        ...(p.sku.trim() ? { sku: p.sku.trim() } : {}),
        ...(primaryType === 'color' && p.color.trim() ? { color: p.color.trim() } : {}),
        ...(p.images[0] ? { imageUrl: p.images[0] } : {}),
        ...(p.images.length ? { images: p.images } : {}),
        ...(Object.keys(imagesBySize).length ? { imagesBySize } : {}),
        ...(Object.keys(stockBySize).length ? { stockBySize } : {}),
        ...(Object.keys(priceBySize).length ? { priceBySize } : {}),
        ...(Object.keys(priceBeforeBySize).length ? { priceBeforeBySize } : {}),
        ...(Object.keys(priceBeforeBySize).length && p.discountStartsAt ? { discountStartsAt: p.discountStartsAt } : {}),
        ...(Object.keys(priceBeforeBySize).length && p.discountEndsAt ? { discountEndsAt: p.discountEndsAt } : {}),
        ...(p.isDefault ? { isDefault: true } : {}),
      };
    });

  const sizeVariants: ProductVariant[] = sizes
    .filter((s) => s.label.trim())
    .map((s) => {
      const id = sizeIdByKey.get(s.key)!;
      const activeForKeys = primary.filter((p) => cells[cellKey(p.key, s.key)]?.active);
      // Omitting `availableFor` means "no restriction" (available for every primary) - only safe
      // when every primary actually has this tamaño active. Any other count (including zero)
      // needs an explicit list, or a tamaño nobody activated would wrongly show up for everyone.
      const availableFor =
        activeForKeys.length < primary.length
          ? activeForKeys.map((p) => primaryIdByKey.get(p.key)!)
          : undefined;
      return {
        id,
        label: s.label.trim(),
        type: 'size' as const,
        price: parseFloat(s.price) || 0,
        stock: parseInt(s.stock, 10) || 0,
        ...(s.sku.trim() ? { sku: s.sku.trim() } : {}),
        ...(availableFor ? { availableFor } : {}),
        ...(s.isDefault ? { isDefault: true } : {}),
      };
    });

  return [...primaryVariants, ...sizeVariants];
}
