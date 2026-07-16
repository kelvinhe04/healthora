import i18n from '../i18n';

/** Panama's store price is always USD - only the number formatting (decimal/group separators,
 * symbol placement) changes with the active language, not the currency itself. */
export function formatCurrency(amount: number, lng: string = i18n.language) {
  const locale = lng.startsWith('en') ? 'en-US' : 'es-PA';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(amount);
}
