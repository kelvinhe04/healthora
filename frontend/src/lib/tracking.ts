/** Sin integracion real con couriers externos (ver seguimiento HU-042): todo envio se asigna a la
 * mensajeria propia de Healthora, sin plantilla de URL de rastreo publica.
 * Espejo de backend/src/lib/tracking.ts. */
export const CARRIERS = {
  propia: { label: 'Mensajería Healthora', trackingUrl: null },
} as const;

export type CarrierId = keyof typeof CARRIERS;

export function carrierLabel(carrier?: string | null): string | null {
  if (!carrier) return null;
  return CARRIERS[carrier as CarrierId]?.label ?? carrier;
}

export function getTrackingUrl(carrier?: string | null, trackingNumber?: string | null): string | null {
  if (!carrier || !trackingNumber) return null;
  const entry = CARRIERS[carrier as CarrierId];
  if (!entry?.trackingUrl) return null;
  return entry.trackingUrl(trackingNumber);
}
