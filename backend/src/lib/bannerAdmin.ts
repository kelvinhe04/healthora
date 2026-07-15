import { Banner } from '../db/models/Banner';
import { Category } from '../db/models/Category';

export type BannerSlot = 'promo' | 'club';

export type UpdateBannerInput = {
  kicker?: string;
  title: string;
  highlightWord?: string;
  description?: string;
  ctaText: string;
  backgroundColor?: string;
  active?: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
  /** Obligatorio para el slot 'promo', ignorado para 'club' - ver buildCtaHref. */
  categoryId?: string;
};

/** El link de cada banner no lo escribe el admin a mano (issue #265 feedback) - sale solo del
 * slot: 'promo' siempre lleva al catalogo filtrado por la categoria elegida, 'club' siempre a la
 * pagina del club. Evita links rotos/inconsistentes con lo que el banner realmente promociona. */
export function buildCtaHref(slot: BannerSlot, categoryId: string | null) {
  if (slot === 'club') return '/club';
  return `/catalog?category=${encodeURIComponent(categoryId ?? '')}`;
}

export async function updateBannerSlot(slot: BannerSlot, input: UpdateBannerInput) {
  const { categoryId, ...rest } = input;

  let resolvedCategoryId: string | null = null;
  if (slot === 'promo') {
    if (!categoryId?.trim()) throw new Error('categoryId es obligatorio para el banner de promoción.');
    const category = await Category.findOne({ id: categoryId }).lean();
    if (!category) throw new Error(`No existe la categoría "${categoryId}".`);
    resolvedCategoryId = categoryId;

    // El texto del banner de promo usa {fechaDesde}/{fechaHasta} (ver bannerText.ts en el frontend) para no repetir
    // a mano una fecha de vigencia que puede quedar desactualizada - por eso hace falta que exista.
    if (!rest.startDate || !rest.endDate) {
      throw new Error('Las fechas de vigencia (desde/hasta) son obligatorias para el banner de promoción.');
    }
  }

  return Banner.findOneAndUpdate(
    { slot },
    { $set: { ...rest, categoryId: resolvedCategoryId, ctaHref: buildCtaHref(slot, resolvedCategoryId), slot } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean();
}
