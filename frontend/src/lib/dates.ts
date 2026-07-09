const PANAMA_TZ = 'America/Panama';

/** Every date shown to the user (admin or storefront) renders in America/Panama, regardless of
 * the viewer's own browser timezone - the store operates on Panama time. */
export function formatPanamaDate(value: string | Date, options: Intl.DateTimeFormatOptions = {}) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('es-PA', { timeZone: PANAMA_TZ, ...options }).format(date);
}

/** Numeric day/month/year/hour/minute parts extracted individually and reassembled by hand -
 * the `es-PA` locale's built-in 2-digit day+month+year pattern actually orders as mm/dd/yyyy
 * (a CLDR quirk specific to Panama), so trusting Intl's automatic field order here silently
 * produces US-style dates instead of the day/month/year order Panama actually uses. */
function getPanamaParts(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat('es-PA', {
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

/** dd/mm/yyyy - compact table columns (ej. "Fecha", "Registro"). */
export function formatPanamaShortDate(value: string | Date) {
  const { day, month, year } = getPanamaParts(value);
  return `${day}/${month}/${year}`;
}

/** hh:mm a. m./p. m. - time-only, paired with formatPanamaShortDate in two-line table cells. */
export function formatPanamaTime(value: string | Date) {
  return getPanamaParts(value).time;
}

/** dd/mm/yyyy hh:mm - single-line date + time (ej. logs de error). */
export function formatPanamaDateTime(value: string | Date) {
  const { day, month, year, time } = getPanamaParts(value);
  return `${day}/${month}/${year} ${time}`;
}

/** dd/mm - chart axis labels grouped by day. */
export function formatPanamaDayMonth(value: string | Date) {
  const { day, month } = getPanamaParts(value);
  return `${day}/${month}`;
}

/** "9 de julio de 2026, 11:35 a. m." - long form for order detail pages. Unambiguous (month is
 * spelled out), so no reordering risk - safe to use Intl's default field order. */
export function formatPanamaFull(value: string | Date) {
  return formatPanamaDate(value, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "9 jul 2026" - short form with abbreviated month name, same reasoning as formatPanamaFull. */
export function formatPanamaMedium(value: string | Date) {
  return formatPanamaDate(value, { day: 'numeric', month: 'short', year: 'numeric' });
}
