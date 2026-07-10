/** Couriers comunes en envios de Panama, con su plantilla de URL de rastreo publica. Un carrier
 * fuera de esta lista (texto libre) simplemente no muestra enlace, solo el numero. */
export const CARRIERS = {
  dhl: { label: 'DHL', trackingUrl: (n: string) => `https://www.dhl.com/pa-es/home/tracking/tracking-express.html?tracking-id=${encodeURIComponent(n)}` },
  ups: { label: 'UPS', trackingUrl: (n: string) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}` },
  fedex: { label: 'FedEx', trackingUrl: (n: string) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}` },
  'correos-panama': { label: 'Correos de Panamá', trackingUrl: (n: string) => `https://www.correospanama.gob.pa/rastreo/?guia=${encodeURIComponent(n)}` },
  propia: { label: 'Mensajería Healthora', trackingUrl: null },
} as const;

export type CarrierId = keyof typeof CARRIERS;

export function carrierLabel(carrier?: string | null): string | null {
  if (!carrier) return null;
  return CARRIERS[carrier as CarrierId]?.label ?? carrier;
}

/** URL publica de rastreo para el carrier + numero dados, o null si el carrier no tiene una
 * plantilla conocida (courier propio, o texto libre que el admin escribio a mano). */
export function getTrackingUrl(carrier?: string | null, trackingNumber?: string | null): string | null {
  if (!carrier || !trackingNumber) return null;
  const entry = CARRIERS[carrier as CarrierId];
  if (!entry?.trackingUrl) return null;
  return entry.trackingUrl(trackingNumber);
}
