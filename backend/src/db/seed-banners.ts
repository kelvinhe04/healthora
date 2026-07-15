import { Banner } from './models/Banner';

/** Los 2 banners fijos del landing (issue #265) - mismo contenido que estaba hardcodeado en
 * Landing.tsx antes de hacerlos editables desde el admin. La fecha de vigencia del primero se
 * actualizo para que coincida con el expiresAt real del cupón PIEL25 (seed-coupons.ts) - el texto
 * original decía "válido hasta el 30 de mayo", desactualizado respecto al cupón real (expira
 * 2026-12-31). Se reseedan enteros (deleteMany + insert): no son documentos que el admin cree o
 * borre, solo edita (ver adminBanners.ts), así que no hay nada de un usuario que preservar aquí. */
const DEFAULT_BANNERS = [
  {
    slot: 'promo' as const,
    title: '25% OFF en tu rutina de skincare',
    kicker: 'Promoción destacada',
    highlightWord: '',
    description: 'Aplica en productos de Salud de la piel. Válido hasta el 31 de diciembre con el código PIEL25.',
    ctaText: 'Comprar rutina',
    ctaHref: '/catalog?category=Salud+de+la+piel',
    categoryId: 'Salud de la piel',
    backgroundColor: 'var(--lime)',
    active: true,
    startDate: null,
    endDate: null,
  },
  {
    slot: 'club' as const,
    title: 'Una muestra gratis en órdenes premium',
    kicker: 'Club Healthora',
    highlightWord: 'gratis',
    description: 'Regístrate y recibe 1 muestra seleccionada en compras mayores a $200.',
    ctaText: 'Unirme al club',
    ctaHref: '/club',
    categoryId: null,
    backgroundColor: 'var(--cream-2)',
    active: true,
    startDate: null,
    endDate: null,
  },
];

export async function seedBanners(): Promise<void> {
  await Banner.deleteMany({});
  await Banner.insertMany(DEFAULT_BANNERS);
}
