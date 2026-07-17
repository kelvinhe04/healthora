import type { TFunction } from 'i18next';

/** Sin integracion real con couriers externos (ver seguimiento HU-042): todo envio se asigna a la
 * mensajeria propia de Healthora, sin plantilla de URL de rastreo publica.
 * Espejo de backend/src/lib/tracking.ts. */
export const CARRIERS = {
  propia: { labelKey: 'healthoraCourier', trackingUrl: null },
} as const;

export type CarrierId = keyof typeof CARRIERS;

// `t` comes from the calling component's useTranslation() - this isn't a component itself (HU-084).
export function carrierLabel(t: TFunction, carrier?: string | null): string | null {
  if (!carrier) return null;
  const entry = CARRIERS[carrier as CarrierId];
  return entry ? t(`admin.orders.carrier.${entry.labelKey}`) : carrier;
}

export function getTrackingUrl(carrier?: string | null, trackingNumber?: string | null): string | null {
  if (!carrier || !trackingNumber) return null;
  const entry = CARRIERS[carrier as CarrierId];
  if (!entry?.trackingUrl) return null;
  return entry.trackingUrl(trackingNumber);
}
