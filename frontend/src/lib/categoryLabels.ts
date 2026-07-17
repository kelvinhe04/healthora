import type { TFunction } from 'i18next';

/** Fixed seeded category taxonomy (same 10 as Footer.tsx's CATEGORY_ITEMS) - maps a category's raw
 * (Spanish) `label`/`id` value to the `footer.categories.*` translation key suffix (HU-084).
 * Categories are technically admin-editable (CategoriesSection.tsx), so any category not in this
 * list falls back to its raw text instead of being translated. */
export const CATEGORY_I18N_KEY: Record<string, string> = {
  Vitaminas: 'vitamins',
  Medicamentos: 'medications',
  'Cuidado personal': 'personalCare',
  'Cuidado del bebé': 'babyCare',
  'Salud de la piel': 'skinHealth',
  Fitness: 'fitness',
  Fragancias: 'fragrances',
  Hidratantes: 'moisturizers',
  Maquillaje: 'makeup',
  'Suplementos de Bienestar': 'wellnessSupplements',
};

/** Translates a category's raw (Spanish) `id`/`label` for display - used anywhere a category name
 * is shown read-only (filter chips, `<select>` options, badges), never where the admin is editing
 * the category record itself (CategoriesSection.tsx keeps the raw value there on purpose). */
export function translatedCategoryLabel(t: TFunction, rawLabel: string): string;
export function translatedCategoryLabel(t: TFunction, rawLabel: string | undefined): string | undefined;
export function translatedCategoryLabel(t: TFunction, rawLabel: string | undefined): string | undefined {
  if (!rawLabel) return rawLabel;
  const key = CATEGORY_I18N_KEY[rawLabel];
  return key ? t(`footer.categories.${key}`) : rawLabel;
}
