import { afterEach, describe, expect, it, setSystemTime } from 'bun:test';
import type { Product, ProductVariant } from '../types';
import {
  getDefaultComboImage,
  getEffectivePrice,
  getEffectivePriceBefore,
  hasTwoDimensions,
  pickDefaultCartVariant,
  pickDefaultCombo,
  pickDefaultPrimary,
  pickDefaultSize,
  pickSizeKeepingCurrent,
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

  it('al cambiar de sabor, mantiene el tamano actual si sigue disponible para el nuevo sabor', () => {
    const variants = [vanilla, chocolate, small, large, universal];
    // `large` esta disponible para chocolate y para vanilla no (solo `small`/`universal`).
    expect(pickSizeKeepingCurrent(variants, chocolate, universal)).toBe(universal);
    expect(pickSizeKeepingCurrent(variants, vanilla, universal)).toBe(universal);
  });

  it('al cambiar de sabor, cae al tamano default si el actual no esta disponible para el nuevo sabor', () => {
    const variants = [vanilla, chocolate, small, large, universal];
    // `large` no esta disponible para vanilla -> cae al default de vanilla (small, el unico ademas de universal).
    expect(pickSizeKeepingCurrent(variants, vanilla, large)).toBe(small);
  });

  it('sin tamano actual, elige el default como pickDefaultSize', () => {
    const variants = [vanilla, chocolate, small, large, universal];
    expect(pickSizeKeepingCurrent(variants, chocolate, null)).toBe(pickDefaultSize(variants, chocolate));
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

  it('un descuento por categoria aplicado a un combo (priceBeforeBySize) manda sobre el priceBefore plano del sabor', () => {
    const chocolateWithComboDiscount = variant({
      id: 'chocolate',
      label: 'Chocolate',
      type: 'flavor',
      price: 24,
      priceBefore: 28,
      isDefault: true,
      priceBySize: { large: 27.5 },
      priceBeforeBySize: { large: 32 },
    });
    const testProduct = product({
      price: 20,
      variants: [vanilla, chocolateWithComboDiscount, small, large, universal],
    });

    expect(getEffectivePrice(testProduct)).toBe(27.5);
    expect(getEffectivePriceBefore(testProduct)).toBe(32);
  });

  it('resuelve el combo default como variante de carrito real (id compuesto), para el quick-add sin selector', () => {
    const testProduct = product({
      price: 20,
      variants: [vanilla, chocolate, small, large, universal],
    });

    const cartVariant = pickDefaultCartVariant(testProduct);
    expect(cartVariant?.id).toBe('chocolate:large');
    expect(cartVariant?.label).toBe('Chocolate · 24 oz');
    expect(cartVariant?.price).toBe(32);
  });

  it('sin dimension de tamano, la variante de carrito por defecto es la variante simple', () => {
    const testProduct = product({ price: 20, variants: [chocolate, vanilla] });
    expect(pickDefaultCartVariant(testProduct)?.id).toBe('chocolate');
  });

  it('sin variantes, no hay variante de carrito por defecto', () => {
    const testProduct = product({ price: 20 });
    expect(pickDefaultCartVariant(testProduct)).toBeUndefined();
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

  it('un descuento vencido oculta el tachado, pero el precio cobrado no cambia (price siempre manda)', () => {
    const testProduct = product({ price: 19, priceBefore: 25, discountEndsAt: '2020-01-01' });

    expect(getEffectivePrice(testProduct)).toBe(19);
    expect(getEffectivePriceBefore(testProduct)).toBeUndefined();
  });

  it('un descuento que aun no empieza oculta el tachado, pero el precio cobrado no cambia', () => {
    const testProduct = product({ price: 19, priceBefore: 25, discountStartsAt: '2999-01-01' });

    expect(getEffectivePrice(testProduct)).toBe(19);
    expect(getEffectivePriceBefore(testProduct)).toBeUndefined();
  });

  it('respeta el descuento propio de la variante para el tachado, sin afectar el precio cobrado', () => {
    const discountedVariant = variant({ id: 'vanilla', label: 'Vanilla', type: 'flavor', price: 15, priceBefore: 22, discountEndsAt: '2020-01-01' });
    const testProduct = product({ price: 19, priceBefore: 25, variants: [discountedVariant] });

    // El precio cobrado es siempre el de la variante (15) - vencido o no, nunca "sube" a 22.
    expect(getEffectivePrice(testProduct)).toBe(15);
    expect(getEffectivePriceBefore(testProduct)).toBeUndefined();
  });

  describe('vigencia (dia calendario de Panama, no medianoche UTC) solo controla el tachado, nunca el precio', () => {
    afterEach(() => setSystemTime());

    it('el tachado sigue mostrandose durante todo el dia de "vigente hasta" en Panama, no solo su primer instante UTC', () => {
      const testProduct = product({ price: 8, priceBefore: 10, discountEndsAt: '2026-07-10' });

      // 2026-07-10T16:40:00Z son las 11:40am en Panama del 10 de julio - todavia el ultimo dia configurado.
      setSystemTime(new Date('2026-07-10T16:40:00Z'));
      expect(getEffectivePriceBefore(testProduct)).toBe(10);
      expect(getEffectivePrice(testProduct)).toBe(8);

      // 2026-07-11T05:00:00Z es medianoche en Panama del 11 de julio - ya vencido: se oculta el
      // tachado, pero el precio cobrado (8) no cambia.
      setSystemTime(new Date('2026-07-11T05:00:00Z'));
      expect(getEffectivePriceBefore(testProduct)).toBeUndefined();
      expect(getEffectivePrice(testProduct)).toBe(8);
    });

    it('el tachado no aparece hasta que "vigente desde" realmente empieza en Panama', () => {
      const testProduct = product({ price: 8, priceBefore: 10, discountStartsAt: '2026-07-11' });

      // 2026-07-10T23:00:00Z son las 6pm en Panama del 10 de julio - el dia anterior, aun sin tachado.
      setSystemTime(new Date('2026-07-10T23:00:00Z'));
      expect(getEffectivePriceBefore(testProduct)).toBeUndefined();
      expect(getEffectivePrice(testProduct)).toBe(8);

      // 2026-07-11T05:00:00Z es medianoche en Panama del 11 de julio - ya aparece el tachado.
      setSystemTime(new Date('2026-07-11T05:00:00Z'));
      expect(getEffectivePriceBefore(testProduct)).toBe(10);
      expect(getEffectivePrice(testProduct)).toBe(8);
    });
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
