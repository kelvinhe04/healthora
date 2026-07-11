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

/** Alfabeto sin caracteres ambiguos (sin I/O/0/1) para que el numero sea facil de leer/transcribir. */
const TRACKING_NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Numero de guia simulado: no hay integracion real con couriers todavia (ver seguimiento HU-042),
 * asi que al pasar un pedido a "enviado" se genera este numero con formato propio en vez de dejarlo vacio. */
export function generateTrackingNumber(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += TRACKING_NUMBER_ALPHABET[Math.floor(Math.random() * TRACKING_NUMBER_ALPHABET.length)];
  }
  return `HLT-${code}`;
}
