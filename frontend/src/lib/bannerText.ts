import { formatPanamaDate } from './dates';

/** Tokens que un banner (título/descripción/CTA) puede incluir para no repetir a mano datos que
 * ya viven en otro lado (issue #265 feedback: "que cambie de forma dinámica") - se resuelven acá,
 * en el momento de mostrarse, así el texto nunca queda desactualizado si la categoría se renombra
 * o la fecha de vigencia cambia. */
export function resolveBannerText(text: string, params: { categoryLabel?: string | null; endDate?: string | null }) {
  const dateLabel = params.endDate
    ? formatPanamaDate(params.endDate, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return text
    .replaceAll('{categoria}', params.categoryLabel ?? '')
    .replaceAll('{fecha}', dateLabel);
}
