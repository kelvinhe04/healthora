import { afterEach, beforeEach, describe, expect, it, setSystemTime } from 'bun:test';
import {
  canApplyPromotion,
  getAvailablePromotionCodes,
  getPromotion,
  normalizePromotionCode,
} from './promotions';

describe('promotions', () => {
  beforeEach(() => {
    setSystemTime(new Date('2026-05-01T12:00:00Z'));
  });

  afterEach(() => {
    setSystemTime();
  });

  it('normaliza codigos y expone promociones disponibles', () => {
    expect(normalizePromotionCode(' bienvenida ')).toBe('BIENVENIDA');
    expect(getAvailablePromotionCodes()).toEqual(expect.arrayContaining(['BIENVENIDA', 'PIEL25']));
  });

  it('aplica BIENVENIDA al subtotal completo', () => {
    expect(
      getPromotion('bienvenida', [
        { product: { category: 'Suplementos', price: 19.99 }, qty: 2 },
        { product: { category: 'Hidratantes', price: 10 }, qty: 1 },
      ])
    ).toEqual({
      code: 'BIENVENIDA',
      label: '15% nuevos clientes',
      discountAmount: 7.5,
    });
  });

  it('aplica PIEL25 solo a categorias elegibles antes de expirar', () => {
    expect(
      getPromotion('PIEL25', [
        { product: { category: 'Hidratantes', price: 20 }, qty: 2 },
        { product: { category: 'Vitaminas', price: 100 }, qty: 1 },
      ])
    ).toEqual({
      code: 'PIEL25',
      label: '25% rutina skincare',
      discountAmount: 10,
    });
  });

  it('rechaza codigos desconocidos, expirados o sin subtotal elegible', () => {
    expect(getPromotion('NOPE', [{ product: { category: 'Hidratantes', price: 20 }, qty: 1 }])).toBeNull();
    expect(getPromotion('PIEL25', [{ product: { category: 'Vitaminas', price: 20 }, qty: 1 }])).toBeNull();

    setSystemTime(new Date('2026-06-01T12:00:00Z'));
    expect(getPromotion('PIEL25', [{ product: { category: 'Hidratantes', price: 20 }, qty: 1 }])).toBeNull();
  });

  it('canApplyPromotion refleja el resultado de getPromotion', () => {
    expect(canApplyPromotion('BIENVENIDA', [{ product: { category: 'Vitaminas', price: 12 }, qty: 1 }])).toBe(true);
    expect(canApplyPromotion('PIEL25', [{ product: { category: 'Vitaminas', price: 12 }, qty: 1 }])).toBe(false);
  });
});
