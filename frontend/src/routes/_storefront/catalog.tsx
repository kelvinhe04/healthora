import { useEffect, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Catalog } from '../../pages/Catalog';
import { useStorefrontNav } from '../../hooks/useStorefrontNav';
import {
  type CatalogFilter,
  normalizeCatalogFilter,
  rememberCatalogBrands,
  readStoredCatalogBrands,
  hasCatalogSearchFilters,
} from '../../lib/catalogFilter';

export const Route = createFileRoute('/_storefront/catalog')({
  validateSearch: (search: Record<string, unknown>): CatalogFilter => ({
    category: typeof search.category === 'string' ? search.category : undefined,
    need: typeof search.need === 'string' ? search.need : undefined,
    search: typeof search.search === 'string' ? search.search : undefined,
    page: typeof search.page === 'number' && search.page > 1 ? search.page : undefined,
    brand: typeof search.brand === 'string' ? search.brand : undefined,
    brands: Array.isArray(search.brands)
      ? search.brands.filter((b): b is string => typeof b === 'string')
      : undefined,
  }),
  component: CatalogRoute,
});

function CatalogRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { openProduct, onAdd } = useStorefrontNav();
  const appliedStoredBrandsRef = useRef(false);

  useEffect(() => {
    if (appliedStoredBrandsRef.current) return;
    appliedStoredBrandsRef.current = true;
    if (hasCatalogSearchFilters(search)) return;
    const storedBrands = readStoredCatalogBrands();
    if (storedBrands.length) {
      navigate({ search: { ...search, brand: storedBrands[0], brands: storedBrands }, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Catalog
      initialFilter={search}
      onFilterChange={(filter) => {
        const nextFilter = normalizeCatalogFilter(filter);
        rememberCatalogBrands(nextFilter);
        navigate({ search: nextFilter, replace: true });
      }}
      onOpenProduct={openProduct}
      onAdd={onAdd}
    />
  );
}
