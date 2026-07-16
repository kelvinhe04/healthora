import { formatPanamaDate } from './dates';

/** Tokens que un banner (título/descripción/CTA) puede incluir para no repetir a mano datos que
 * ya viven en otro lado (issue #265 feedback: "que cambie de forma dinámica") - se resuelven acá,
 * en el momento de mostrarse, así el texto nunca queda desactualizado si la categoría se renombra
 * o la fecha de vigencia cambia. Hay 2 fechas (Vigente desde/hasta) y cada una tiene su propio
 * token - no hay un {fecha} genérico que adivine cuál de las dos se quiso decir. */
export function resolveBannerText(
  text: string,
  params: { categoryLabel?: string | null; startDate?: string | null; endDate?: string | null },
) {
  const formatDate = (value?: string | null) =>
    value ? formatPanamaDate(value, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return text
    .replaceAll('{categoria}', params.categoryLabel ?? '')
    .replaceAll('{fechaDesde}', formatDate(params.startDate))
    .replaceAll('{fechaHasta}', formatDate(params.endDate));
}
