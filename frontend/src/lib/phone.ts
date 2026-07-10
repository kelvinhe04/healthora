/** Formats a phone number as an 8-digit Panama local number with an auto dash (e.g. "6123-4567"). */
export function formatPanamaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}
