import { describe, expect, it } from 'bun:test';
import type { Product, ProductVariant } from '../types';
import {
  getDefaultComboImage,
  getEffectivePrice,
  getEffectivePriceBefore,
  hasTwoDimensions,
  pickDefaultCombo,
  pickDefaultPrimary,
  pickDefaultSize,
  resolveVariantById,
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

  it('usa el precio override de la combinacion en vez de sumar sabor + tamano', () => {
    const chocolateWithOverride = variant({
      id: 'chocolate',
      label: 'Chocolate',
      type: 'flavor',
      price: 24,
      isDefault: true,
      priceBySize: { large: 27.5 },
    });
    const testProduct = product({
      price: 20,
      variants: [chocolateWithOverride, small, large],
    });

    expect(getEffectivePrice(testProduct)).toBe(27.5);
  });

  it('usa precio base cuando no hay variantes', () => {
    const testProduct = product({ price: 19, priceBefore: 25 });

    expect(pickDefaultCombo(testProduct)).toEqual({ variant: null, size: null });
    expect(getEffectivePrice(testProduct)).toBe(19);
    expect(getEffectivePriceBefore(testProduct)).toBe(25);
  });

  it('usa la foto especifica del combo default (sabor+tamano), no solo la del sabor', () => {
    const chocolateWithCombo = variant({
      id: 'chocolate',
      label: 'Chocolate',
      type: 'flavor',
      price: 24,
      isDefault: true,
      images: ['/chocolate-general.jpg'],
      imagesBySize: { large: ['/chocolate-large-combo.jpg'] },
    });
    const testProduct = product({
      variants: [chocolateWithCombo, small, large],
    });

    expect(getDefaultComboImage(testProduct)).toBe('/chocolate-large-combo.jpg');
  });

  it('cambia la foto de portada al marcar otro combo como default', () => {
    const chocolate = variant({
      id: 'chocolate',
      label: 'Chocolate',
      type: 'flavor',
      price: 24,
      isDefault: true,
      images: ['/chocolate-general.jpg'],
      imagesBySize: { small: ['/chocolate-small-combo.jpg'], big: ['/chocolate-big-combo.jpg'] },
    });
    const smallSize = variant({ id: 'small', label: 'Small', type: 'size', price: 0, isDefault: true });
    const bigSize = variant({ id: 'big', label: 'Big', type: 'size', price: 5 });

    const defaultsToSmall = product({ variants: [chocolate, smallSize, bigSize] });
    expect(getDefaultComboImage(defaultsToSmall)).toBe('/chocolate-small-combo.jpg');

    // admin flips which size is marked default in the "Combinaciones" table
    const defaultsToBig = product({
      variants: [chocolate, { ...smallSize, isDefault: false }, { ...bigSize, isDefault: true }],
    });
    expect(getDefaultComboImage(defaultsToBig)).toBe('/chocolate-big-combo.jpg');
  });

  it('resuelve el precio de un combo por id usando el override si existe, si no sabor + tamano', () => {
    const chocolateWithOverride = variant({
      id: 'chocolate',
      label: 'Chocolate',
      type: 'flavor',
      price: 24,
      priceBySize: { large: 27.5 },
    });

    expect(resolveVariantById([chocolateWithOverride, large], 'chocolate:large')?.price).toBe(27.5);
    expect(resolveVariantById([chocolateWithOverride, small], 'chocolate:small')?.price).toBe(24);
  });
});
