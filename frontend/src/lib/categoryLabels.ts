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
