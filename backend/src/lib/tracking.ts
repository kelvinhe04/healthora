/** Sin integracion real con couriers externos (ver seguimiento HU-042): todo envio se asigna a la
 * mensajeria propia de Healthora, sin plantilla de URL de rastreo publica. */
export const CARRIERS = {
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
