export type CatalogFilter = {
  category?: string;
  need?: string;
  search?: string;
  page?: number;
  brand?: string;
  brands?: string[];
};

const CATALOG_BRANDS_STORAGE_KEY = 'healthora_catalog_brands';

export function getFilterBrands(filter?: CatalogFilter): string[] {
  return filter?.brands?.length ? filter.brands : filter?.brand ? [filter.brand] : [];
}

export function normalizeCatalogFilter(filter?: CatalogFilter): CatalogFilter {
  const brands = getFilterBrands(filter);
  return {
    category: filter?.category && filter.category !== 'Todos' ? filter.category : undefined,
    need: filter?.need || undefined,
    search: filter?.search?.trim() ? filter.search : undefined,
    page: filter?.page && filter.page > 1 ? filter.page : undefined,
    brand: brands[0] || undefined,
    brands: brands.length ? brands : undefined,
  };
}

export function rememberCatalogBrands(filter?: CatalogFilter) {
  const brands = getFilterBrands(filter);
  if (brands.length) {
    sessionStorage.setItem(CATALOG_BRANDS_STORAGE_KEY, JSON.stringify(brands));
  } else {
    sessionStorage.removeItem(CATALOG_BRANDS_STORAGE_KEY);
  }
}

export function readStoredCatalogBrands(): string[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CATALOG_BRANDS_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export function clearStoredCatalogBrands() {
  sessionStorage.removeItem(CATALOG_BRANDS_STORAGE_KEY);
}

export function hasCatalogSearchFilters(filter: CatalogFilter): boolean {
  return Boolean(filter.category || filter.need || filter.search || filter.page || filter.brand);
}
