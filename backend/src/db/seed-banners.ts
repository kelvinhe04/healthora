import { Banner } from './models/Banner';

/** Banners default (issue #265) - mismo contenido que estaba hardcodeado en Landing.tsx antes de
 * hacerlos editables desde el admin. La fecha de vigencia del primero se actualizo para que
 * coincida con el expiresAt real del cupón PIEL25 (seed-coupons.ts) - el texto original decía
 * "válido hasta el 30 de mayo", desactualizado respecto al cupón real (expira 2026-12-31). */
const DEFAULT_BANNERS = [
  {
    title: '25% OFF en tu rutina de skincare',
    kicker: 'Promoción destacada',
    highlightWord: '',
    description: 'Aplica en productos de Salud de la piel e Hidratantes. Válido hasta el 31 de diciembre con el código PIEL25.',
    ctaText: 'Comprar rutina',
    ctaHref: '/catalog',
    backgroundColor: 'var(--lime)',
    imageUrl: '',
    active: true,
    order: 0,
    startDate: null,
    endDate: null,
  },
  {
    title: 'Una muestra gratis en órdenes premium',
    kicker: 'Club Healthora',
    highlightWord: 'gratis',
    description: 'Regístrate y recibe 1 muestra seleccionada en compras mayores a $200.',
    ctaText: 'Unirme al club',
    ctaHref: '/club',
    backgroundColor: 'var(--cream-2)',
    imageUrl: '',
    active: true,
    order: 1,
    startDate: null,
    endDate: null,
  },
];

export async function seedBanners(): Promise<void> {
  for (const banner of DEFAULT_BANNERS) {
    await Banner.updateOne({ title: banner.title }, { $set: banner }, { upsert: true });
  }
}
