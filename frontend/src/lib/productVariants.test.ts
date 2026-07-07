import { describe, expect, it } from 'bun:test';
import type { Product, ProductVariant } from '../types';
import {
  getEffectivePrice,
  getEffectivePriceBefore,
  hasTwoDimensions,
  pickDefaultCombo,
  pickDefaultPrimary,
  pickDefaultSize,
  sizesFor,
} from './productVariants';

const variant = (overrides: Partial<ProductVariant> & Pick<ProductVariant, 'id' | 'label' | 'type' | 'price'>): ProductVariant => ({
  stock: 10,
  ...overrides,
});

const product = (overrides: Partial<Product> = {}): Product => ({
  _id: 'p1',
  id: 'p1',
  name: 'Producto de prueba',
  brand: 'Healthora',
  category: 'Suplementos',
  need: 'Energia',
  price: 20,
  rating: 4.5,
  reviews: 12,
  short: 'Producto para pruebas',
  benefits: [],
  usage: '',
  ingredients: '',
  warnings: '',
  stock: 10,
  color: '#fff',
  swatchColor: '#fff',
  label: 'Prueba',
  active: true,
  ...overrides,
});

describe('productVariants', () => {
  const vanilla = variant({ id: 'vanilla', label: 'Vanilla', type: 'flavor', price: 22 });
  const chocolate = variant({ id: 'chocolate', label: 'Chocolate', type: 'flavor', price: 24, priceBefore: 28, isDefault: true });
  const small = variant({ id: 'small', label: '12 oz', type: 'size', price: 0, availableFor: ['vanilla'] });
  const large = variant({ id: 'large', label: '24 oz', type: 'size', price: 8, isDefault: true, availableFor: ['chocolate'] });
  const universal = variant({ id: 'universal', label: 'Sampler', type: 'size', price: 3 });

  it('elige la variante primaria marcada como default', () => {
    expect(pickDefaultPrimary([vanilla, chocolate])).toBe(chocolate);
  });

  it('filtra tamanos disponibles segun la variante primaria', () => {
    expect(sizesFor([small, large, universal], chocolate)).toEqual([large, universal]);
    expect(sizesFor([small, large, universal], vanilla)).toEqual([small, universal]);
  });

  it('elige el tamano default disponible para la variante primaria', () => {
    expect(pickDefaultSize([small, large, universal], chocolate)).toBe(large);
    expect(pickDefaultSize([small, universal], chocolate)).toBe(universal);
  });

  it('detecta productos con dimensiones primaria y tamano', () => {
    expect(hasTwoDimensions([vanilla, large])).toBe(true);
    expect(hasTwoDimensions([large, universal])).toBe(false);
  });

  it('calcula combo, precio y precio anterior efectivos', () => {
    const testProduct = product({
      price: 20,
      priceBefore: 26,
      variants: [vanilla, chocolate, small, large, universal],
    });

    expect(pickDefaultCombo(testProduct)).toEqual({ variant: chocolate, size: large });
    expect(getEffectivePrice(testProduct)).toBe(32);
    expect(getEffectivePriceBefore(testProduct)).toBe(28);
  });

  it('usa precio base cuando no hay variantes', () => {
    const testProduct = product({ price: 19, priceBefore: 25 });

    expect(pickDefaultCombo(testProduct)).toEqual({ variant: null, size: null });
    expect(getEffectivePrice(testProduct)).toBe(19);
    expect(getEffectivePriceBefore(testProduct)).toBe(25);
  });
});
