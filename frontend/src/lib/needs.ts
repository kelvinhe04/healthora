/** Landing's "Por necesidad" cards — each links straight to the one category it represents (via
 * `category`), so the catalog's sidebar highlights and filters correctly. `id` stays around only
 * as the React key / `need` label for display. */
export const NEEDS = [
  { id: 'Piel seca', label: 'Piel seca', tone: 'half-left', category: 'Salud de la piel' },
  { id: 'Energía y vitaminas', label: 'Energía y vitaminas', tone: 'half-right', category: 'Vitaminas' },
  { id: 'Cuidado del bebé', label: 'Cuidado del bebé', tone: 'ring', category: 'Cuidado del bebé' },
  { id: 'Fitness y recuperación', label: 'Fitness y recuperación', tone: 'solid', category: 'Fitness' },
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
