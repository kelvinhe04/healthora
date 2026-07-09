export type ShippingZone = 'capital' | 'interior' | 'pickup';
export type ShippingSpeed = 'standard' | 'express';

export const SHIPPING_ZONES: ShippingZone[] = ['capital', 'interior', 'pickup'];
export const SHIPPING_SPEEDS: ShippingSpeed[] = ['standard', 'express'];

const RATES: Record<Exclude<ShippingZone, 'pickup'>, Record<ShippingSpeed, { cost: number; eta: string }>> = {
  capital: {
    standard: { cost: 3.5, eta: '24-48h' },
    express: { cost: 7.9, eta: 'Mismo día / next-day' },
  },
  interior: {
    standard: { cost: 8.9, eta: '3-5 días' },
    express: { cost: 14.9, eta: '1-2 días' },
  },
};

const FREE_SHIPPING_THRESHOLD = 50;

export interface ShippingSelection {
  zone: ShippingZone;
  speed: ShippingSpeed;
}

export interface ResolvedShipping {
  cost: number;
  label: string;
  eta: string;
}

const ZONE_LABELS: Record<ShippingZone, string> = {
  capital: 'Ciudad de Panamá / área metropolitana',
  interior: 'Interior del país',
  pickup: 'Retiro en tienda',
};

export function resolveShipping(selection: ShippingSelection, discountedSubtotal: number): ResolvedShipping {
  const { zone, speed } = selection;

  if (zone === 'pickup') {
    return { cost: 0, label: `${ZONE_LABELS.pickup}`, eta: 'Listo en 24h' };
  }

  const rate = RATES[zone][speed];
  const freeShipping = discountedSubtotal >= FREE_SHIPPING_THRESHOLD || discountedSubtotal === 0;

  return {
    cost: freeShipping ? 0 : rate.cost,
    label: `${ZONE_LABELS[zone]} · ${speed === 'express' ? 'Express' : 'Estándar'}`,
    eta: rate.eta,
  };
}
