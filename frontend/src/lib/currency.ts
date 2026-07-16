import i18n from '../i18n';

/** Panama's store price is always USD - only the number formatting (decimal/group separators)
 * changes with the active language, not the currency itself. `currencyDisplay: 'narrowSymbol'` is
 * required: the `es-PA` locale's default CLDR data renders the currency as the "USD" code instead
 * of "$" (the app has always shown "$" everywhere), so without forcing the symbol, prices would
 * silently switch from "$11.99" to "USD 11.99" the moment the language switches to Spanish. */
export function formatCurrency(amount: number, lng: string = i18n.language) {
  const locale = lng.startsWith('en') ? 'en-US' : 'es-PA';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(amount);
}

/** Plain number with locale-aware group/decimal separators (e.g. review counts) - same locale
 * resolution as formatCurrency, just without the currency formatting. */
export function formatNumber(value: number, lng: string = i18n.language) {
  const locale = lng.startsWith('en') ? 'en-US' : 'es-PA';
  return new Intl.NumberFormat(locale).format(value);
}
