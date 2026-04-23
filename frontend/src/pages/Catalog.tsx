import { useState, useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { Product } from '../types';
import { ProductCard } from '../components/shared/ProductCard';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';

interface CatalogProps {
  initialFilter?: { category?: string; need?: string };
  onOpenProduct: (p: Product) => void;
  onAdd: (p: Product) => void;
}

const filterLabel: CSSProperties = { fontFamily: '"JetBrains Mono", monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 12 };

export function Catalog({ initialFilter, onOpenProduct, onAdd }: CatalogProps) {
  const [cat, setCat] = useState(initialFilter?.category || 'Todos');
  const [need, setNeed] = useState(initialFilter?.need || null as string | null);
  const [sort, setSort] = useState('featured');
  const [priceMax, setPriceMax] = useState(100);
  const [brands, setBrands] = useState<string[]>([]);
  const [inStock, setInStock] = useState(false);

  const { data: allProducts = [] } = useProducts();
  const { data: categories = [] } = useCategories();

  const allBrands = [...new Set(allProducts.map((p) => p.brand))];

  const filtered = useMemo(() => {
    let list = allProducts.slice();
    if (cat !== 'Todos') list = list.filter((p) => p.category === cat);
    if (need) list = list.filter((p) => p.need === need);
    list = list.filter((p) => p.price <= priceMax);
    if (brands.length) list = list.filter((p) => brands.includes(p.brand));
    if (inStock) list = list.filter((p) => p.stock > 0);
    if (sort === 'priceAsc') list.sort((a, b) => a.price - b.price);
    if (sort === 'priceDesc') list.sort((a, b) => b.price - a.price);
    if (sort === 'rating') list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [allProducts, cat, need, sort, priceMax, brands, inStock]);

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
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 520, justifyContent: 'flex-end' }}>
          {['Todos', ...categories.slice(0, 5).map((c) => c.id)].map((c) => (
            <button key={c} onClick={() => setCat(c)} style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid ' + (cat === c ? 'var(--ink)' : 'var(--ink-20)'), background: cat === c ? 'var(--ink)' : 'transparent', color: cat === c ? 'var(--cream)' : 'var(--ink)', fontSize: 12, fontFamily: '"Geist", sans-serif', cursor: 'pointer' }}>{c}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 32 }}>
        <aside style={{ position: 'sticky', top: 100, alignSelf: 'start' }}>
          <div style={{ marginBottom: 32 }}>
            <div style={filterLabel}>Categorías</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['Todos', ...categories.map((c) => c.id)].map((c) => (
                <label key={c} onClick={() => setCat(c)} style={{ padding: '6px 0', fontSize: 14, cursor: 'pointer', color: cat === c ? 'var(--green)' : 'var(--ink)', fontFamily: '"Geist", sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: cat === c ? 500 : 400 }}>
                  <span>{c}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-40)', fontFamily: '"JetBrains Mono", monospace' }}>
                    {c === 'Todos' ? allProducts.length : allProducts.filter((p) => p.category === c).length}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 32 }}>
            <div style={filterLabel}>Precio máximo · ${priceMax}</div>
            <input type="range" min={5} max={100} value={priceMax} onChange={(e) => setPriceMax(+e.target.value)} style={{ width: '100%', accentColor: 'oklch(0.35 0.06 155)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace', marginTop: 4 }}>
              <span>$5</span><span>$100</span>
            </div>
          </div>
          <div style={{ marginBottom: 32 }}>
            <div style={filterLabel}>Marcas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allBrands.map((b) => (
                <label key={b} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', fontFamily: '"Geist", sans-serif' }}>
                  <input type="checkbox" checked={brands.includes(b)} onChange={() => toggleBrand(b)} style={{ accentColor: 'var(--green)' }} />
                  {b}
                </label>
              ))}
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
            <span style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>Mostrando {filtered.length} de {allProducts.length} resultados</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ padding: '10px 16px', borderRadius: 999, border: '1px solid var(--ink-20)', background: 'transparent', fontSize: 13, fontFamily: '"Geist", sans-serif', cursor: 'pointer' }}>
              <option value="featured">Destacados</option>
              <option value="rating">Mejor valorados</option>
              <option value="priceAsc">Menor precio</option>
              <option value="priceDesc">Mayor precio</option>
            </select>
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: 80, textAlign: 'center', color: 'var(--ink-60)', fontFamily: '"Instrument Serif", serif', fontSize: 28 }}>Sin resultados con estos filtros.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {filtered.map((p) => <ProductCard key={p.id} product={p} onClick={onOpenProduct} onAdd={onAdd} />)}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
