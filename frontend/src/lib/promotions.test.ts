import { describe, expect, it } from 'bun:test';
import { normalizePromotionCode } from './promotions';

describe('promotions client helpers', () => {
  it('normaliza codigos de cupón', () => {
    expect(normalizePromotionCode(' bienvenida ')).toBe('BIENVENIDA');
  });
});
