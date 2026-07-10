export type ShippingZone = 'capital' | 'interior' | 'pickup';
export type ShippingSpeed = 'standard' | 'express';

export const SHIPPING_ZONE_OPTIONS: { value: ShippingZone; label: string }[] = [
  { value: 'capital', label: 'Ciudad de Panamá / área metropolitana' },
  { value: 'interior', label: 'Interior del país' },
  { value: 'pickup', label: 'Retiro en tienda' },
];

export const SHIPPING_SPEED_OPTIONS: { value: ShippingSpeed; label: string }[] = [
  { value: 'standard', label: 'Estándar' },
  { value: 'express', label: 'Express' },
];

const RATES: Record<Exclude<ShippingZone, 'pickup'>, Record<ShippingSpeed, { cost: number; eta: string }>> = {
  capital: {
    standard: { cost: 3.5, eta: '3-4 días' },
    express: { cost: 7.9, eta: 'Mismo día / 24h' },
  },
  interior: {
    standard: { cost: 8.9, eta: '5-7 días' },
    express: { cost: 14.9, eta: '2-3 días' },
  },
};

const FREE_SHIPPING_THRESHOLD = 50;

export interface ResolvedShipping {
  cost: number;
  label: string;
  eta: string;
}

// Distritos/corregimientos del área metropolitana (ciudad de Panamá + San Miguelito + Panamá Oeste
// cercano) - lo que no matchea se asume interior. Heurística simple para autocompletar la zona a
// partir de la ciudad que el cliente ya escribió, no un catálogo geográfico exhaustivo.
const CAPITAL_AREA_KEYWORDS = [
  'san miguelito', 'arraijan', 'la chorrera', 'chorrera',
  'tocumen', 'juan diaz', 'pedregal', 'ancon', 'albrook', 'condado del rey', 'el dorado',
  'bethania', 'betania', 'parque lefevre', 'rio abajo', 'chorrillo', 'calidonia', 'bella vista',
  'obarrio', 'punta pacifica', 'costa del este', 'clayton',
];

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function guessZoneFromCity(city: string): Exclude<ShippingZone, 'pickup'> {
  const normalized = normalizeForMatch(city);
  if (!normalized) return 'capital';
  if (normalized === 'panama' || normalized.includes('panama')) return 'capital';
  return CAPITAL_AREA_KEYWORDS.some((keyword) => normalized.includes(keyword)) ? 'capital' : 'interior';
}

export function resolveShipping(zone: ShippingZone, speed: ShippingSpeed, discountedSubtotal: number): ResolvedShipping {
  if (zone === 'pickup') {
    return { cost: 0, label: 'Retiro en tienda', eta: 'Listo en 24h' };
  }

  const rate = RATES[zone][speed];
  const freeShipping = discountedSubtotal >= FREE_SHIPPING_THRESHOLD || discountedSubtotal === 0;
  const zoneLabel = SHIPPING_ZONE_OPTIONS.find((z) => z.value === zone)?.label ?? zone;
  const speedLabel = SHIPPING_SPEED_OPTIONS.find((s) => s.value === speed)?.label ?? speed;

  return {
    cost: freeShipping ? 0 : rate.cost,
    label: `${zoneLabel} · ${speedLabel}`,
    eta: rate.eta,
  };
}
