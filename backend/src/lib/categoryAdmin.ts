import { Category } from '../db/models/Category';
import { Product } from '../db/models/Product';
import { clearCatalogCache } from './cache';

export type CategoryRecord = {
  _id: unknown;
  id: string;
  label: string;
  sub?: string;
  color?: string;
  active: boolean;
};

export type UpsertCategoryInput = {
  id: string;
  label?: string;
  sub?: string;
  color?: string;
  active?: boolean;
  newId?: string;
};

export type UpsertCategoryResult = {
  created: boolean;
  category: CategoryRecord;
  productsReassigned: number;
};

export async function countProductsInCategory(categoryId: string): Promise<number> {
  return Product.countDocuments({ category: categoryId });
}

export async function reassignProductsCategory(fromId: string, toId: string): Promise<number> {
  const result = await Product.updateMany({ category: fromId }, { $set: { category: toId } });
  return result.modifiedCount;
}

export async function upsertCategory(input: UpsertCategoryInput): Promise<UpsertCategoryResult> {
  const { id, newId, ...fields } = input;
  const existing = await Category.findOne({ id }).lean();

  if (!existing) {
    if (!fields.label?.trim()) {
      throw new Error('Para crear una categoría nueva se requiere label.');
    }
    const category = await Category.create({
      id,
      label: fields.label.trim(),
      sub: fields.sub?.trim() || undefined,
      color: fields.color?.trim() || undefined,
      active: fields.active ?? true,
    });
    await clearCatalogCache();
    return {
      created: true,
      category: category.toObject() as CategoryRecord,
      productsReassigned: 0,
    };
  }

  let productsReassigned = 0;
  const targetId = newId?.trim() && newId.trim() !== id ? newId.trim() : id;

  if (targetId !== id) {
    const conflict = await Category.findOne({ id: targetId }).lean();
    if (conflict) throw new Error(`Ya existe una categoría con id "${targetId}".`);

    productsReassigned = await reassignProductsCategory(id, targetId);
    await Category.deleteOne({ id });
    const category = await Category.create({
      id: targetId,
      label: (fields.label ?? existing.label).trim(),
      sub: fields.sub !== undefined ? fields.sub.trim() || undefined : existing.sub,
      color: fields.color !== undefined ? fields.color.trim() || undefined : existing.color,
      active: fields.active ?? existing.active ?? true,
    });
    await clearCatalogCache();
    return {
      created: false,
      category: category.toObject() as CategoryRecord,
      productsReassigned,
    };
  }

  const update: Record<string, unknown> = {};
  if (fields.label !== undefined) update.label = fields.label.trim();
  if (fields.sub !== undefined) update.sub = fields.sub.trim() || undefined;
  if (fields.color !== undefined) update.color = fields.color.trim() || undefined;
  if (fields.active !== undefined) update.active = fields.active;

  const category = await Category.findOneAndUpdate(
    { id },
    { $set: update },
    { new: true },
  ).lean();

  if (!category) throw new Error(`Categoría "${id}" no encontrada.`);

  await clearCatalogCache();
  return {
    created: false,
    category: category as CategoryRecord,
    productsReassigned,
  };
}

export async function listAdminCategories() {
  const categories = await Category.find().sort({ label: 1 }).lean();
  const counts = await Product.aggregate<{ _id: string; count: number }>([
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const countById = new Map(counts.map((row) => [row._id, row.count]));

  return categories.map((cat) => ({
    ...cat,
    active: cat.active !== false,
    productCount: countById.get(cat.id) ?? 0,
  }));
}
