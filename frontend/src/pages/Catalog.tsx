import { useState, useMemo, useEffect } from 'react';
import type { CSSProperties } from 'react';
import type { Product } from '../types';
import { ProductCard } from '../components/shared/ProductCard';
import { Icon } from '../components/shared/Icon';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';

interface CatalogProps {
  initialFilter?: { category?: string; need?: string; search?: string };
  onOpenProduct: (p: Product) => void;
  onAdd: (p: Product) => void;
}

const filterLabel: CSSProperties = { fontFamily: '"JetBrains Mono", monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 12 };
const ITEMS_PER_PAGE = 12;

export function Catalog({ initialFilter, onOpenProduct, onAdd }: CatalogProps) {
  const [cat, setCat] = useState(initialFilter?.category || 'Todos');
  const [need, setNeed] = useState(initialFilter?.need || null as string | null);
  const [search, setSearch] = useState(initialFilter?.search || '');
  const [sort, setSort] = useState('featured');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [priceMax, setPriceMax] = useState(1000);
  const [brands, setBrands] = useState<string[]>([]);
  const [brandSearch, setBrandSearch] = useState('');
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [inStock, setInStock] = useState(false);

  const { data: allProducts = [] } = useProducts();
  const { data: categories = [] } = useCategories();

  useEffect(() => {
    setCat(initialFilter?.category || 'Todos');
    setNeed(initialFilter?.need || null);
    setSearch(initialFilter?.search || '');
  }, [initialFilter?.category, initialFilter?.need, initialFilter?.search]);

  useEffect(() => {
    setPage(1);
  }, [cat, need, search, sort, priceMax, brands, inStock]);

  const allBrands = [...new Set(allProducts.map((p) => p.brand))].sort((a, b) => a.localeCompare(b));
  const brandCounts = useMemo(
    () => Object.fromEntries(allBrands.map((brand) => [brand, allProducts.filter((p) => p.brand === brand).length])),
    [allBrands, allProducts]
  );
  const filteredBrands = useMemo(() => {
    const term = brandSearch.trim().toLowerCase();
    return allBrands.filter((brand) => !term || brand.toLowerCase().includes(term));
  }, [allBrands, brandSearch]);
  const visibleBrands = showAllBrands ? filteredBrands : filteredBrands.slice(0, 8);

  const filtered = useMemo(() => {
    let list = allProducts.slice();
    if (cat !== 'Todos') list = list.filter((p) => p.category === cat);
    if (need) list = list.filter((p) => p.need === need);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((p) =>
        [p.name, p.brand, p.category, p.short, p.tag, p.need]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      );
    }
    list = list.filter((p) => p.price <= priceMax);
    if (brands.length) list = list.filter((p) => brands.includes(p.brand));
    if (inStock) list = list.filter((p) => p.stock > 0);
    if (sort === 'priceAsc') list.sort((a, b) => a.price - b.price);
    if (sort === 'priceDesc') list.sort((a, b) => b.price - a.price);
    if (sort === 'rating') list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [allProducts, cat, need, search, sort, priceMax, brands, inStock]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter((value) => {
    if (totalPages <= 5) return true;
    return value === 1 || value === totalPages || Math.abs(value - currentPage) <= 1;
  });

  useEffect(() => {
    setShowAllBrands(false);
  }, [brandSearch]);

  const toggleBrand = (b: string) => setBrands((bs) => bs.includes(b) ? bs.filter((x) => x !== b) : [...bs, b]);

  return (
    <main style={{ padding: '32px 40px 0' }}>
      <div style={{ background: 'var(--cream-2)', borderRadius: 24, padding: '40px 48px', marginBottom: 32, display: 'flex', alignItems: 'end', justifyContent: 'space-between', border: '1px solid var(--ink-06)' }}>
        <div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 10 }}>Catálogo · {filtered.length} productos</div>
          <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 72, letterSpacing: '-0.035em', lineHeight: 0.95, margin: 0, color: 'var(--ink)', fontWeight: 400 }}>
            {cat === 'Todos' ? <>Toda la <em style={{ color: 'var(--green)' }}>tienda</em></> : <>{cat}</>}
          </h1>
          {need && <div style={{ marginTop: 12, fontSize: 14, color: 'var(--ink-60)' }}>Filtro: {need} · <a onClick={() => setNeed(null)} style={{ color: 'var(--green)', cursor: 'pointer' }}>limpiar</a></div>}
          {search && <div style={{ marginTop: 12, fontSize: 14, color: 'var(--ink-60)' }}>Búsqueda: "{search}" · <a onClick={() => setSearch('')} style={{ color: 'var(--green)', cursor: 'pointer' }}>limpiar</a></div>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 32 }}>
        <aside style={{ position: 'sticky', top: 100, alignSelf: 'start' }}>
          <div style={{ marginBottom: 32 }}>
            <div style={filterLabel}>Categorías</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {['Todos', ...categories.map((c) => c.id)].map((c) => (
                <label key={c} onClick={() => setCat(c)} 
                  style={{ 
                    padding: '8px 12px', 
                    marginLeft: -12, 
                    borderRadius: 8, 
                    fontSize: 14, 
                    cursor: 'pointer', 
                    background: cat === c ? 'var(--green)' : 'transparent', 
                    color: cat === c ? 'var(--cream)' : 'var(--ink)', 
                    fontFamily: '"Geist", sans-serif', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    fontWeight: cat === c ? 500 : 400, 
                    transition: 'all 0.2s ease' 
                  }}
                  onMouseEnter={(e) => { if (cat !== c) e.currentTarget.style.background = 'var(--ink-04)'; }}
                  onMouseLeave={(e) => { if (cat !== c) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span>{c}</span>
                  <span style={{ fontSize: 11, color: cat === c ? 'rgba(255,255,255,0.7)' : 'var(--ink-40)', fontFamily: '"JetBrains Mono", monospace' }}>
                    {c === 'Todos' ? allProducts.length : allProducts.filter((p) => p.category === c).length}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 32 }}>
            <div style={filterLabel}>Precio máximo · ${priceMax}</div>
            <input type="range" min={5} max={1000} value={priceMax} onChange={(e) => setPriceMax(+e.target.value)} style={{ width: '100%', accentColor: 'oklch(0.35 0.06 155)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace', marginTop: 4 }}>
              <span>$5</span><span>$1000</span>
            </div>
          </div>
          <div style={{ marginBottom: 32 }}>
            <div style={filterLabel}>Marcas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--ink-04)', borderRadius: 999, padding: '8px 12px' }}>
                <Icon name="search" size={14} stroke="var(--ink-40)" />
                <input
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  placeholder={`Buscar entre ${allBrands.length} marcas`}
                  aria-label="Buscar marca"
                  style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 13, fontFamily: '"Geist", sans-serif' }}
                />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {visibleBrands.map((b) => {
                  const selected = brands.includes(b);
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => toggleBrand(b)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 999, border: selected ? '1px solid var(--green)' : '1px solid var(--ink-20)', background: selected ? 'var(--green)' : 'transparent', color: selected ? 'var(--cream)' : 'var(--ink)', cursor: 'pointer', fontSize: 12, fontFamily: '"Geist", sans-serif', transition: 'all 0.2s ease' }}
                    >
                      <span>{b}</span>
                      <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', opacity: selected ? 0.8 : 0.6 }}>{brandCounts[b]}</span>
                    </button>
                  );
                })}
              </div>
              {filteredBrands.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>No hay marcas que coincidan.</div>}
              {filteredBrands.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllBrands((value) => !value)}
                  style={{ alignSelf: 'flex-start', padding: 0, border: 'none', background: 'transparent', color: 'var(--green)', cursor: 'pointer', fontSize: 12, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.04em' }}
                >
                  {showAllBrands ? 'Ver menos' : `Ver más (${filteredBrands.length - 8})`}
                </button>
              )}
            </div>
          </div>
          <div style={{ marginBottom: 32 }}>
            <div style={filterLabel}>Disponibilidad</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', fontFamily: '"Geist", sans-serif' }}>
              <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} style={{ accentColor: 'var(--green)' }} /> En stock
            </label>
          </div>
        </aside>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--ink-06)' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + (filtered.length ? 1 : 0)}-{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length} resultados</span>
            
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setIsSortOpen(!isSortOpen)}
                style={{ padding: '10px 16px', borderRadius: 999, border: '1px solid var(--ink-20)', background: 'transparent', fontSize: 13, fontFamily: '"Geist", sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}
              >
                {sort === 'featured' ? 'Destacados' : sort === 'rating' ? 'Mejor valorados' : sort === 'priceAsc' ? 'Menor precio' : 'Mayor precio'}
                <Icon name="chevron-down" size={14} />
              </button>
              
              {isSortOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setIsSortOpen(false)} />
                  <div style={{ position: 'absolute', top: '100%', right: '50%', transform: 'translateX(50%)', marginTop: 8, background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 16, padding: 6, minWidth: 180, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', zIndex: 20, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[
                      { value: 'featured', label: 'Destacados' },
                      { value: 'rating', label: 'Mejor valorados' },
                      { value: 'priceAsc', label: 'Menor precio' },
                      { value: 'priceDesc', label: 'Mayor precio' },
                    ].map((o) => (
                      <button 
                        key={o.value} 
                        onClick={() => { setSort(o.value); setIsSortOpen(false); }}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none', background: sort === o.value ? 'var(--ink-04)' : 'transparent', color: sort === o.value ? 'var(--ink)' : 'var(--ink-60)', fontSize: 13, fontFamily: '"Geist", sans-serif', cursor: 'pointer', textAlign: 'left', fontWeight: sort === o.value ? 500 : 400, transition: 'all 0.2s' }}
                        onMouseEnter={(e) => { if (sort !== o.value) { e.currentTarget.style.background = 'rgba(0,0,0,0.02)'; e.currentTarget.style.color = 'var(--ink)'; } }}
                        onMouseLeave={(e) => { if (sort !== o.value) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-60)'; } }}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: 80, textAlign: 'center', color: 'var(--ink-60)', fontFamily: '"Instrument Serif", serif', fontSize: 28 }}>Sin resultados con estos filtros.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {paginated.map((p) => <ProductCard key={p.id} product={p} onClick={onOpenProduct} onAdd={onAdd} />)}
            </div>
          )}
          {filtered.length > ITEMS_PER_PAGE && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--ink-06)' }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 999, border: '1px solid var(--ink-20)', background: 'transparent', color: currentPage === 1 ? 'var(--ink-40)' : 'var(--ink)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontFamily: '"Geist", sans-serif', fontSize: 13 }}
              >
                <Icon name="arrow-left" size={14} /> Anterior
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {pageNumbers.map((value, index) => {
                  const previous = pageNumbers[index - 1];
                  const showGap = previous && value - previous > 1;
                  return (
                    <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {showGap && <span style={{ color: 'var(--ink-40)', fontFamily: '"JetBrains Mono", monospace' }}>...</span>}
                      <button
                        onClick={() => setPage(value)}
                        style={{ width: 40, height: 40, borderRadius: 999, border: value === currentPage ? '1px solid var(--green)' : '1px solid var(--ink-20)', background: value === currentPage ? 'var(--green)' : 'transparent', color: value === currentPage ? 'var(--cream)' : 'var(--ink)', cursor: 'pointer', fontFamily: '"Geist", sans-serif', fontSize: 13, fontWeight: value === currentPage ? 600 : 400 }}
                      >
                        {value}
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 999, border: '1px solid var(--ink-20)', background: 'transparent', color: currentPage === totalPages ? 'var(--ink-40)' : 'var(--ink)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontFamily: '"Geist", sans-serif', fontSize: 13 }}
              >
                Siguiente <Icon name="arrow-right" size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
