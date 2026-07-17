import i18n from '../i18n';

const PANAMA_TZ = 'America/Panama';

/** HU-084: la tienda siempre opera en hora de Panama (timeZone se mantiene fijo sin importar la
 * zona horaria del navegador del usuario), pero el locale de despliegue sigue el idioma activo de
 * la app - un lector en ingles ve "Jul 9, 2026" en vez de "9 jul 2026". */
function resolveLocale(locale?: string) {
  const lng = locale ?? i18n.language ?? 'es';
  return lng.startsWith('en') ? 'en-US' : 'es-PA';
}

export function formatPanamaDate(value: string | Date, options: Intl.DateTimeFormatOptions = {}, locale?: string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(resolveLocale(locale), { timeZone: PANAMA_TZ, ...options }).format(date);
}

/** Numeric day/month/year/hour/minute parts extracted individually and reassembled by hand -
 * both the `es-PA` and `en-US` locales' built-in 2-digit day+month+year pattern order as
 * mm/dd/yyyy (a CLDR quirk specific to es-PA, and simply the native US order for en-US), so
 * trusting Intl's automatic field order for es-PA would silently produce US-style dates instead
 * of the day/month/year order Panama actually uses. */
function getPanamaParts(value: string | Date, locale?: string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat(resolveLocale(locale), {
    timeZone: PANAMA_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    day: get('day'),
    month: get('month'),
    year: get('year'),
    time: `${get('hour')}:${get('minute')} ${get('dayPeriod')}`.trim(),
  };
}

/** dd/mm/yyyy (es) o mm/dd/yyyy (en) - compact table columns (ej. "Fecha", "Registro"). */
export function formatPanamaShortDate(value: string | Date, locale?: string) {
  const { day, month, year } = getPanamaParts(value, locale);
  return resolveLocale(locale) === 'en-US' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
}

/** hh:mm a. m./p. m. - time-only, paired with formatPanamaShortDate en two-line table cells. */
export function formatPanamaTime(value: string | Date, locale?: string) {
  return getPanamaParts(value, locale).time;
}

/** dd/mm/yyyy hh:mm (o mm/dd/yyyy hh:mm en en) - single-line date + time (ej. logs de error). */
export function formatPanamaDateTime(value: string | Date, locale?: string) {
  const { day, month, year, time } = getPanamaParts(value, locale);
  const datePart = resolveLocale(locale) === 'en-US' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
  return `${datePart} ${time}`;
}

/** dd/mm (o mm/dd en en) - chart axis labels grouped by day. */
export function formatPanamaDayMonth(value: string | Date, locale?: string) {
  const { day, month } = getPanamaParts(value, locale);
  return resolveLocale(locale) === 'en-US' ? `${month}/${day}` : `${day}/${month}`;
}

/** "9 de julio de 2026, 11:35 a. m." (es) / "July 9, 2026, 11:35 AM" (en) - long form for order
 * detail pages. Unambiguous (month is spelled out), so no reordering risk - safe to use Intl's
 * default field order. */
export function formatPanamaFull(value: string | Date, locale?: string) {
  return formatPanamaDate(value, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }, locale);
}

/** "9 jul 2026" / "Jul 9, 2026" - short form with abbreviated month name, same reasoning as
 * formatPanamaFull. */
export function formatPanamaMedium(value: string | Date, locale?: string) {
  return formatPanamaDate(value, { day: 'numeric', month: 'short', year: 'numeric' }, locale);
}
