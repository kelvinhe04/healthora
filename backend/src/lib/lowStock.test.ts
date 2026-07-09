import { describe, expect, test } from 'bun:test';
import { enumerateStockCells } from './lowStock';

describe('enumerateStockCells', () => {
  test('product without variants -> single product-level cell', () => {
    expect(enumerateStockCells({ id: 'aspirin', name: 'Aspirina', stock: 4 })).toEqual([
      { productId: 'aspirin', productMongoId: null, productName: 'Aspirina', variantId: null, variantLabel: null, stock: 4 },
    ]);
  });

  test('carries the Mongo _id through as productMongoId, stringified', () => {
    const cells = enumerateStockCells({ id: 'aspirin', name: 'Aspirina', stock: 4, _id: { toString: () => 'mongo123' } });
    expect(cells[0].productMongoId).toBe('mongo123');
  });

  test('simple variants -> one cell per variant with its own stock', () => {
    const cells = enumerateStockCells({
      id: 'lipstick',
      name: 'Labial',
      stock: 10,
      variants: [
        { id: 'red', label: 'Rojo', type: 'color', stock: 3 },
        { id: 'pink', label: 'Rosa', type: 'color', stock: 7 },
      ],
    });
    expect(cells).toEqual([
      { productId: 'lipstick', productMongoId: null, productName: 'Labial', variantId: 'red', variantLabel: 'Rojo', stock: 3 },
      { productId: 'lipstick', productMongoId: null, productName: 'Labial', variantId: 'pink', variantLabel: 'Rosa', stock: 7 },
    ]);
  });

  test('matrix product -> one cell per sabor x tamano combo (stockBySize overrides tamano)', () => {
    const cells = enumerateStockCells({
      id: 'protein',
      name: 'Proteína',
      stock: 100,
      variants: [
        { id: 'vanilla', label: 'Vainilla', type: 'flavor', stock: 0, stockBySize: { '2lb': 2, '5lb': 40 } },
        { id: 'choco', label: 'Choco', type: 'flavor', stock: 0 },
        { id: '2lb', label: '2lb', type: 'size', stock: 9 },
        { id: '5lb', label: '5lb', type: 'size', stock: 8 },
      ],
    });
    // vanilla:2lb -> override 2, vanilla:5lb -> override 40, choco:2lb -> size 9, choco:5lb -> size 8
    expect(cells).toEqual([
      { productId: 'protein', productMongoId: null, productName: 'Proteína', variantId: 'vanilla:2lb', variantLabel: 'Vainilla · 2lb', stock: 2 },
      { productId: 'protein', productMongoId: null, productName: 'Proteína', variantId: 'vanilla:5lb', variantLabel: 'Vainilla · 5lb', stock: 40 },
      { productId: 'protein', productMongoId: null, productName: 'Proteína', variantId: 'choco:2lb', variantLabel: 'Choco · 2lb', stock: 9 },
      { productId: 'protein', productMongoId: null, productName: 'Proteína', variantId: 'choco:5lb', variantLabel: 'Choco · 5lb', stock: 8 },
    ]);
  });

  test('respects availableFor: a size restricted to one sabor is not paired with others', () => {
    const cells = enumerateStockCells({
      id: 'p',
      name: 'P',
      stock: 0,
      variants: [
        { id: 'vanilla', label: 'Vainilla', type: 'flavor', stock: 0 },
        { id: 'choco', label: 'Choco', type: 'flavor', stock: 0 },
        { id: 'travel', label: 'Travel', type: 'size', stock: 3, availableFor: ['vanilla'] },
      ],
    });
    expect(cells.map((c) => c.variantId)).toEqual(['vanilla:travel']);
  });
});
