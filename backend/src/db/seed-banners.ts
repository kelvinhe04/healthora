import { Banner } from './models/Banner';

/** Los 2 banners fijos del landing (issue #265) - mismo contenido que estaba hardcodeado en
 * Landing.tsx antes de hacerlos editables desde el admin. `title`/`description`/`ctaText` del
 * slot 'promo' usan los tokens {categoria}, {fechaDesde} y {fechaHasta} (ver
 * frontend/src/lib/bannerText.ts): se resuelven en el momento de mostrarse a partir de
 * `categoryId`/`startDate`/`endDate` reales, así que nunca
 * quedan desactualizados como pasaba con el texto hardcodeado original ("válido hasta el 30 de
 * mayo", que ya no coincidía con el expiresAt real del cupón PIEL25 en seed-coupons.ts). Se
 * reseedan enteros (deleteMany + insert): no son documentos que el admin cree o borre, solo edita
 * (ver adminBanners.ts), así que no hay nada de un usuario que preservar aquí. */
const DEFAULT_BANNERS = [
  {
    slot: 'promo' as const,
    title: '25% OFF en productos de {categoria}',
    kicker: 'Promoción destacada',
    highlightWord: '',
    description: 'Aplica en productos de {categoria}. Vigente del {fechaDesde} al {fechaHasta} con el código PIEL25.',
    ctaText: 'Comprar {categoria}',
    ctaHref: '/catalog?category=Salud+de+la+piel',
    categoryId: 'Salud de la piel',
    backgroundColor: 'var(--lime)',
    active: true,
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2026-12-31T23:59:59Z'),
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
