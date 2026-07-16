/** Landing's "Por necesidad" cards — each links straight to the one category it represents (via
 * `category`), so the catalog's sidebar highlights and filters correctly. `id`/`label` stay as the
 * raw Spanish value (React key / CATEGORY_TO_NEED lookup value); `i18nKey` is the display-only
 * translation key suffix under `landing.byNeed.items` (HU-084). */
export const NEEDS = [
  { id: 'Piel seca', label: 'Piel seca', i18nKey: 'drySkin', tone: 'half-left', category: 'Salud de la piel' },
  { id: 'Energía y vitaminas', label: 'Energía y vitaminas', i18nKey: 'energyVitamins', tone: 'half-right', category: 'Vitaminas' },
  { id: 'Cuidado del bebé', label: 'Cuidado del bebé', i18nKey: 'babyCare', tone: 'ring', category: 'Cuidado del bebé' },
  { id: 'Fitness y recuperación', label: 'Fitness y recuperación', i18nKey: 'fitnessRecovery', tone: 'solid', category: 'Fitness' },
] as const;

/** Derives a product's "necesidad" from its category, instead of asking the admin to pick one by
 * hand (which drifted out of sync with reality — see git history). Categories with no natural
 * match (Medicamentos, Cuidado personal, Fragancias, Maquillaje) are left out on purpose: those
 * products just won't surface in the "Por necesidad" Landing section. */
export const CATEGORY_TO_NEED: Record<string, string> = {
  Vitaminas: 'Energía y vitaminas',
  'Suplementos de Bienestar': 'Energía y vitaminas',
  'Salud de la piel': 'Piel seca',
  Hidratantes: 'Piel seca',
  'Cuidado del bebé': 'Cuidado del bebé',
  Fitness: 'Fitness y recuperación',
};
