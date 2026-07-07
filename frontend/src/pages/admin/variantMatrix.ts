import type { ProductVariant } from '../../types';
import { PRIMARY_VARIANT_TYPES } from '../../lib/productVariants';
import { slugify } from './utils';

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
  /** Combo-specific images; empty array means "fall back to the sabor's images". */
  images: string[];
};

export type MatrixState = {
  primaryType: 'flavor' | 'scent';
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
  return { key: newKey(), id: '', label: '', price: '0', stock: '0', sku: '', isDefault: false, images: [] };
}

export function emptySizeRow(): MatrixSizeRow {
  return { key: newKey(), id: '', label: '', price: '0', stock: '0', sku: '', isDefault: false };
}

export function emptyMatrixState(): MatrixState {
  return { primaryType: 'flavor', primary: [], sizes: [], cells: {} };
}

export function decomposeToMatrix(variants: ProductVariant[]): MatrixState {
  const primaryVariants = variants.filter((v) => PRIMARY_VARIANT_TYPES.includes(v.type));
  const sizeVariants = variants.filter((v) => v.type === 'size');
  const primaryType = (primaryVariants[0]?.type as 'flavor' | 'scent') ?? 'flavor';

  const primary: MatrixPrimaryRow[] = primaryVariants.map((v) => ({
    key: v.id,
    id: v.id,
    label: v.label,
    price: String(v.price),
    stock: String(v.stock),
    sku: v.sku ?? '',
    isDefault: Boolean(v.isDefault),
    images: v.images?.length ? v.images : v.imageUrl ? [v.imageUrl] : [],
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
      const active = !s.availableFor?.length || s.availableFor.includes(p.id);
      if (!active) continue;
      cells[cellKey(p.id, s.id)] = {
        active: true,
        stock: p.stockBySize?.[s.id] != null ? String(p.stockBySize[s.id]) : '',
        images: p.imagesBySize?.[s.id] ?? [],
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
      for (const s of sizes) {
        const cell = cells[cellKey(p.key, s.key)];
        if (!cell?.active) continue;
        const sizeId = sizeIdByKey.get(s.key)!;
        if (cell.images.length) imagesBySize[sizeId] = cell.images;
        if (cell.stock.trim() !== '') stockBySize[sizeId] = parseInt(cell.stock, 10) || 0;
      }
      return {
        id,
        label: p.label.trim(),
        type: primaryType,
        price: parseFloat(p.price) || 0,
        stock: parseInt(p.stock, 10) || 0,
        ...(p.sku.trim() ? { sku: p.sku.trim() } : {}),
        ...(p.images[0] ? { imageUrl: p.images[0] } : {}),
        ...(p.images.length ? { images: p.images } : {}),
        ...(Object.keys(imagesBySize).length ? { imagesBySize } : {}),
        ...(Object.keys(stockBySize).length ? { stockBySize } : {}),
        ...(p.isDefault ? { isDefault: true } : {}),
      };
    });

  const sizeVariants: ProductVariant[] = sizes
    .filter((s) => s.label.trim())
    .map((s) => {
      const id = sizeIdByKey.get(s.key)!;
      const activeForKeys = primary.filter((p) => cells[cellKey(p.key, s.key)]?.active);
      const availableFor =
        activeForKeys.length > 0 && activeForKeys.length < primary.length
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
