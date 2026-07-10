export type ShippingMethod = 'delivery' | 'pickup';

export const SHIPPING_METHOD_OPTIONS: { value: ShippingMethod; label: string }[] = [
  { value: 'delivery', label: 'Envío a domicilio' },
  { value: 'pickup', label: 'Retiro en tienda' },
];

const DELIVERY_RATE = { cost: 6.9, eta: '3-5 días' };
const FREE_SHIPPING_THRESHOLD = 50;

export interface ResolvedShipping {
  cost: number;
  label: string;
  eta: string;
}

export function resolveShipping(method: ShippingMethod, discountedSubtotal: number): ResolvedShipping {
  if (method === 'pickup') {
    return { cost: 0, label: 'Retiro en tienda', eta: 'Listo en 24h' };
  }

  const freeShipping = discountedSubtotal >= FREE_SHIPPING_THRESHOLD || discountedSubtotal === 0;

  return {
    cost: freeShipping ? 0 : DELIVERY_RATE.cost,
    label: 'Envío a domicilio',
    eta: DELIVERY_RATE.eta,
  };
}
