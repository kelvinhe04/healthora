import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  clearStoredCatalogBrands,
  getFilterBrands,
  hasCatalogSearchFilters,
  normalizeCatalogFilter,
  readStoredCatalogBrands,
  rememberCatalogBrands,
} from './catalogFilter';

function createSessionStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe('catalogFilter', () => {
  const originalSessionStorage = globalThis.sessionStorage;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: createSessionStorageMock(),
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: originalSessionStorage,
    });
  });

  it('normaliza filtros vacios y valores por defecto', () => {
    expect(
      normalizeCatalogFilter({
        category: 'Todos',
        need: '',
        search: '   ',
        page: 1,
      })
    ).toEqual({
      category: undefined,
      need: undefined,
      search: undefined,
      page: undefined,
      brand: undefined,
      brands: undefined,
    });
  });

  it('prefiere brands sobre brand heredado', () => {
    const filter = { brand: 'CeraVe', brands: ['La Roche-Posay', 'The Ordinary'] };

    expect(getFilterBrands(filter)).toEqual(['La Roche-Posay', 'The Ordinary']);
    expect(normalizeCatalogFilter(filter)).toMatchObject({
      brand: 'La Roche-Posay',
      brands: ['La Roche-Posay', 'The Ordinary'],
    });
  });

  it('recuerda, lee y limpia marcas persistidas', () => {
    rememberCatalogBrands({ brands: ['CeraVe', 'Aveeno'], brand: 'Ignorada' });

    expect(readStoredCatalogBrands()).toEqual(['CeraVe', 'Aveeno']);

    rememberCatalogBrands({});
    expect(readStoredCatalogBrands()).toEqual([]);

    rememberCatalogBrands({ brand: 'Cetaphil' });
    clearStoredCatalogBrands();
    expect(readStoredCatalogBrands()).toEqual([]);
  });

  it('ignora datos corruptos o no string en sessionStorage', () => {
    sessionStorage.setItem('healthora_catalog_brands', '["CeraVe", 123, null, "Aveeno"]');
    expect(readStoredCatalogBrands()).toEqual(['CeraVe', 'Aveeno']);

    sessionStorage.setItem('healthora_catalog_brands', '{');
    expect(readStoredCatalogBrands()).toEqual([]);
  });

  it('detecta filtros activos de busqueda', () => {
    expect(hasCatalogSearchFilters({})).toBe(false);
    expect(hasCatalogSearchFilters({ search: 'proteina' })).toBe(true);
    expect(hasCatalogSearchFilters({ brand: 'CeraVe' })).toBe(true);
  });
});
