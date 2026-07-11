import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  PageHeader,
  Skeleton,
  StatusPill,
  tableStyle,
  td,
  th,
  trStyle,
  iconBtnAd,
  SortableTh,
  SortClearChip,
  DateInputDDMMYYYY,
} from '../../../components/admin';
import { AnimatedButton } from '../../../components/shared/AnimatedButton';
import { Icon } from '../../../components/shared/Icon';
import { ModalOverlay } from '../../../components/shared/ModalOverlay';
import { ProductImage } from '../../../components/shared/ProductImage';
import { Stars } from '../../../components/shared/Stars';
import { PaginationControls } from '../components/PaginationControls';
import { ProductModal } from '../components/ProductModal';
import { useAdminPanelContext } from '../AdminPanelContext';
import { variantSummary } from '../utils';
import type { ProductSortKey } from '../hooks/useAdminPanel';
import { getTotalStock, getEffectivePrice, getEffectivePriceBefore } from '../../../lib/productVariants';
import { api } from '../../../lib/api';

const modalFieldLabel = { fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--ink-60)', marginBottom: 6, display: 'block' };
const modalInput = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--ink-20)', background: 'var(--cream)', fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink)', boxSizing: 'border-box' as const };

function CategoryDiscountModal({ open, onClose, categories }: { open: boolean; onClose: () => void; categories: string[] }) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('10');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [message, setMessage] = useState('');
  const invalidRange = Boolean(startsAt && endsAt && endsAt < startsAt);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    void queryClient.invalidateQueries({ queryKey: ['products'] });
    void queryClient.invalidateQueries({ queryKey: ['product'] });
  };

  const applyMut = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return api.admin.products.applyCategoryDiscount(
        {
          category,
          discountType,
          value: parseFloat(value) || 0,
          ...(startsAt ? { discountStartsAt: startsAt } : {}),
          ...(endsAt ? { discountEndsAt: endsAt } : {}),
        },
        token!,
      );
    },
    onSuccess: (data) => {
      setMessage(`${data.updated} de ${data.total} producto(s) actualizados.`);
      invalidate();
    },
  });

  const removeMut = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return api.admin.products.removeCategoryDiscount(category, token!);
    },
    onSuccess: (data) => {
      setMessage(`Descuento quitado de ${data.updated} producto(s).`);
      invalidate();
    },
  });

  return (
    <ModalOverlay open={open} onClose={onClose}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 20, padding: 24 }}>
        <h3 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 24, margin: '0 0 16px' }}>Descuento por categoría</h3>
        <div style={{ marginBottom: 14 }}>
          <label style={modalFieldLabel}>Categoría</label>
          <select style={modalInput} value={category} onChange={(e) => { setCategory(e.target.value); setMessage(''); }}>
            <option value="">Seleccionar categoría…</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={modalFieldLabel}>Tipo</label>
            <select style={modalInput} value={discountType} onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}>
              <option value="percent">Porcentaje (%)</option>
              <option value="fixed">Monto fijo ($)</option>
            </select>
          </div>
          <div>
            <label style={modalFieldLabel}>Valor</label>
            <input style={modalInput} type="number" min={0} step={0.01} value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
          <div>
            <label style={modalFieldLabel}>Vigente desde (opcional)</label>
            <DateInputDDMMYYYY style={modalInput} value={startsAt} onChange={setStartsAt} />
          </div>
          <div>
            <label style={modalFieldLabel}>Vigente hasta (opcional)</label>
            <DateInputDDMMYYYY style={modalInput} value={endsAt} onChange={setEndsAt} />
          </div>
        </div>
        {invalidRange && <div role="alert" style={{ marginBottom: 14, fontSize: 13, color: 'var(--coral)' }}>"Vigente hasta" no puede ser anterior a "Vigente desde".</div>}
        {message && <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--green)' }}>{message}</div>}
        {(applyMut.isError || removeMut.isError) && <div role="alert" style={{ marginBottom: 14, fontSize: 13, color: 'var(--coral)' }}>No se pudo completar la acción.</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => removeMut.mutate()} disabled={!category || removeMut.isPending} style={{ padding: '10px 16px', borderRadius: 10, background: 'transparent', border: '1px solid var(--ink-12)', color: 'var(--coral)', cursor: 'pointer', fontSize: 13 }}>
            Quitar descuento
          </button>
          <AnimatedButton variant="primary" disabled={!category || (parseFloat(value) || 0) <= 0 || invalidRange || applyMut.isPending} onClick={() => applyMut.mutate()} text={applyMut.isPending ? 'Aplicando…' : 'Aplicar descuento'} />
        </div>
      </div>
    </ModalOverlay>
  );
}

const PRODUCT_SORT_LABEL: Record<ProductSortKey, string> = {
  price: 'Precio',
  stock: 'Stock',
  rating: 'Reseña',
  active: 'Estado',
};

function ProductRatingCell({ summary }: { summary?: { avgRating: number; count: number } }) {
  if (!summary || summary.count === 0) {
    return (
      <span style={{ fontSize: 10, color: 'var(--ink-40)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
        SIN RESEÑAS
      </span>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      <Stars value={summary.avgRating} size={12} />
      <span style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace', whiteSpace: 'nowrap' }}>
        {summary.avgRating} · {summary.count}
      </span>
    </div>
  );
}

export function ProductsSection() {
  const {
  showProductsSkeleton,
  products,
  productCatFilter,
  setProductCatFilter,
  categories,
  categoryCounts,
  productSearch,
  setProductSearch,
  productStatusFilter,
  setProductStatusFilter,
  statusCounts,
  productSort,
  toggleProductSort,
  clearProductSort,
  reviewsSummary,
  setProductModal,
  highlightVariantId,
  selectedProductIds,
  setSelectedProductIds,
  allDisplayedSelected,
  selectedDisplayedIds,
  displayedProductIds,
  displayedProducts,
  paginatedProducts,
  setProductsPage,
  setConfirmDeleteId,
  setConfirmBulkDelete,
  setConfirmDeleteAll,
  confirmDeleteId,
  confirmBulkDelete,
  confirmDeleteAll,
  confirmUserDelete,
  setConfirmUserDelete,
  productModal,
  isSaving,
  productUpdateMutation,
  productCreateMutation,
  productDeleteMutation,
  bulkDeleteMutation,
  deleteAllMutation,
  userDeleteMutation,
  deleteError,
  setDeleteError,
  } = useAdminPanelContext();

  const [discountModalOpen, setDiscountModalOpen] = useState(false);

  return (
    <>
          <>
            <PageHeader
              loading={showProductsSkeleton}
              kicker={
                showProductsSkeleton
                  ? undefined
                  : `Catálogo · ${products.length} productos`
              }
              title={
                <>
                  Gestión de{" "}
                  <em style={{ color: "var(--green)" }}>productos</em>
                </>
              }
              sub="Agrega, edita, elimina y filtra el catálogo completo."
              actions={
                showProductsSkeleton ? (
                  <Skeleton height={40} width={152} borderRadius={999} />
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setDiscountModalOpen(true)}
                      style={{ padding: "10px 16px", borderRadius: 999, background: "transparent", border: "1px solid var(--ink-12)", color: "var(--ink)", cursor: "pointer", fontSize: 13, fontFamily: '"Geist", sans-serif' }}
                    >
                      Descuento por categoría
                    </button>
                    <AnimatedButton variant="primary" onClick={() => setProductModal({ mode: "add" })} text="+ Agregar producto" />
                  </>
                )
              }
            />
            <CategoryDiscountModal open={discountModalOpen} onClose={() => setDiscountModalOpen(false)} categories={categories} />

            {/* Filter bar */}
            {showProductsSkeleton ? (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginBottom: 20,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <Skeleton height={36} width={296} borderRadius={999} />
                {[74, 88, 80, 68, 76, 84, 70, 78, 74, 66].map((w, i) => (
                  <Skeleton key={i} height={32} width={w} borderRadius={999} />
                ))}
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginBottom: 20,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "var(--cream)",
                    borderRadius: 999,
                    padding: "9px 16px",
                    border: "1px solid var(--ink-06)",
                    flexShrink: 0,
                    width: 296,
                    boxSizing: "border-box",
                  }}
                >
                  <Icon name="search" size={14} stroke="var(--ink-40)" />
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar por nombre o marca…"
                    style={{
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontSize: 13,
                      fontFamily: '"Geist", sans-serif',
                      width: "100%",
                      color: "var(--ink)",
                    }}
                  />
                  {productSearch && (
                    <button
                      onClick={() => setProductSearch("")}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: "2px 4px",
                        display: "flex",
                        alignItems: "center",
                        color: "var(--ink-40)",
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="x" size={13} />
                    </button>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {["Todos", ...categories].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setProductCatFilter(cat)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 14px",
                        borderRadius: 999,
                        fontSize: 12,
                        cursor: "pointer",
                        border:
                          "1px solid " +
                          (productCatFilter === cat
                            ? "var(--ink)"
                            : "var(--ink-20)"),
                        background:
                          productCatFilter === cat
                            ? "var(--ink)"
                            : "transparent",
                        color:
                          productCatFilter === cat
                            ? "var(--cream)"
                            : "var(--ink)",
                        fontFamily: '"Geist", sans-serif',
                        transition: "all 120ms",
                      }}
                    >
                      <span>{cat}</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: '"JetBrains Mono", monospace',
                          opacity: productCatFilter === cat ? 0.8 : 0.6,
                        }}
                      >
                        {categoryCounts[cat] ?? 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!showProductsSkeleton && (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginBottom: 20,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                {(["Todos", "Activo", "Inactivo"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setProductStatusFilter(status)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 999,
                      fontSize: 11,
                      cursor: "pointer",
                      border:
                        "1px solid " +
                        (productStatusFilter === status
                          ? "var(--ink)"
                          : "var(--ink-20)"),
                      background:
                        productStatusFilter === status
                          ? "var(--ink)"
                          : "transparent",
                      color:
                        productStatusFilter === status
                          ? "var(--cream)"
                          : "var(--ink-60)",
                      fontFamily: '"Geist", sans-serif',
                      transition: "all 120ms",
                    }}
                  >
                    <span>{status}</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: '"JetBrains Mono", monospace',
                        opacity: productStatusFilter === status ? 0.8 : 0.6,
                      }}
                    >
                      {statusCounts[status] ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {showProductsSkeleton ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <Skeleton height={12} width={248} borderRadius={4} />
                <div style={{ display: "flex", gap: 8 }}>
                  <Skeleton height={32} width={126} borderRadius={999} />
                  <Skeleton height={32} width={158} borderRadius={999} />
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontFamily: '"Geist", sans-serif',
                      color: "var(--ink-60)",
                    }}
                  >
                    {selectedDisplayedIds.length > 0
                      ? `${selectedDisplayedIds.length} seleccionados en esta vista`
                      : "Selecciona varios productos para borrado masivo."}
                  </div>
                  <SortClearChip sort={productSort} labels={PRODUCT_SORT_LABEL} onClear={clearProductSort} />
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <AnimatedButton
                    variant="outline"
                    onClick={() => setSelectedProductIds((current) => current.filter((id) => !displayedProductIds.includes(id)))}
                    disabled={selectedDisplayedIds.length === 0}
                    text="Limpiar selección"
                  />
                  <AnimatedButton
                    variant="outline"
                    onClick={() => setConfirmBulkDelete({ ids: selectedDisplayedIds, title: "Eliminar seleccionados", description: `Se eliminarán ${selectedDisplayedIds.length} productos seleccionados de esta vista.` })}
                    disabled={selectedDisplayedIds.length === 0}
                    style={{ color: "oklch(0.5 0.15 30)", borderColor: "oklch(0.85 0.08 30)" }}
                    text="Eliminar seleccionados"
                  />
                  <AnimatedButton
                    variant="outline"
                    onClick={() => setConfirmDeleteAll(true)}
                    style={{ color: "var(--coral)", borderColor: "oklch(0.85 0.08 30)" }}
                    text="Eliminar todo"
                  />
                </div>
              </div>
            )}

            <Card
              pad={0}
              loading={showProductsSkeleton}
              skeletonContent={
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {/* Column headers */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 24px",
                      borderBottom: "1px solid var(--ink-06)",
                    }}
                  >
                    <div style={{ width: 52, flexShrink: 0 }} />
                    <div style={{ flex: 2 }}>
                      <Skeleton height={9} width={58} borderRadius={3} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Skeleton height={9} width={66} borderRadius={3} />
                    </div>
                    <div style={{ flex: 0.8 }}>
                      <Skeleton height={9} width={44} borderRadius={3} />
                    </div>
                    <div style={{ flex: 0.6 }}>
                      <Skeleton height={9} width={38} borderRadius={3} />
                    </div>
                    <div style={{ flex: 0.8 }}>
                      <Skeleton height={9} width={46} borderRadius={3} />
                    </div>
                    <div style={{ flex: 0.8 }}>
                      <Skeleton height={9} width={50} borderRadius={3} />
                    </div>
                    <div style={{ flex: 0.8 }}>
                      <Skeleton height={9} width={46} borderRadius={3} />
                    </div>
                    <div style={{ width: 66, flexShrink: 0 }} />
                  </div>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 24px",
                        borderBottom: "1px solid var(--ink-06)",
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        style={{
                          width: 52,
                          display: "flex",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Skeleton height={16} width={16} borderRadius={3} />
                      </div>
                      {/* Producto: image 60×72 + name + brand */}
                      <div
                        style={{
                          flex: 2,
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <Skeleton
                          height={72}
                          width={60}
                          borderRadius={8}
                          style={{ flexShrink: 0 }}
                        />
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 5,
                          }}
                        >
                          <Skeleton height={13} width={110} borderRadius={4} />
                          <Skeleton height={10} width={80} borderRadius={4} />
                        </div>
                      </div>
                      {/* Categoría: plain text */}
                      <div style={{ flex: 1 }}>
                        <Skeleton height={11} width={72} borderRadius={4} />
                      </div>
                      {/* Precio: serif price + strikethrough */}
                      <div
                        style={{
                          flex: 0.8,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <Skeleton height={18} width={58} borderRadius={4} />
                        <Skeleton height={10} width={42} borderRadius={4} />
                      </div>
                      {/* Stock */}
                      <div style={{ flex: 0.6 }}>
                        <Skeleton height={13} width={30} borderRadius={4} />
                      </div>
                      {/* Reseña: stars + count */}
                      <div style={{ flex: 0.8 }}>
                        <Skeleton height={13} width={64} borderRadius={4} />
                      </div>
                      {/* Estado: pill */}
                      <div style={{ flex: 0.8 }}>
                        <Skeleton height={22} width={62} borderRadius={999} />
                      </div>
                      {/* Actions: 2 icon buttons 30×30 */}
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <Skeleton height={30} width={30} borderRadius={8} />
                        <Skeleton height={30} width={30} borderRadius={8} />
                      </div>
                    </div>
                  ))}
                </div>
              }
            >
              <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ ...tableStyle, minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 52 }}>
                      <input
                        type="checkbox"
                        checked={allDisplayedSelected}
                        onChange={(e) =>
                          setSelectedProductIds((current) =>
                            e.target.checked
                              ? Array.from(
                                  new Set([...current, ...displayedProductIds]),
                                )
                              : current.filter(
                                  (id) => !displayedProductIds.includes(id),
                                ),
                          )
                        }
                        aria-label="Seleccionar productos visibles"
                        style={{
                          width: 16,
                          height: 16,
                          accentColor: "var(--green)",
                          cursor: "pointer",
                        }}
                      />
                    </th>
                    <th style={th}>Producto</th>
                    <th style={th}>Categoría</th>
                    <SortableTh label="Precio" sortKey="price" activeSort={productSort} onSort={toggleProductSort} />
                    <SortableTh label="Stock" sortKey="stock" activeSort={productSort} onSort={toggleProductSort} />
                    <SortableTh label="Reseña" sortKey="rating" activeSort={productSort} onSort={toggleProductSort} />
                    <SortableTh label="Estado" sortKey="active" activeSort={productSort} onSort={toggleProductSort} />
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.items.map((product) => {
                    const variantInfo = variantSummary(product);
                    return (
                    <tr key={product.id} style={trStyle}>
                      <td style={{ ...td, width: 52 }}>
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(
                            product._id || product.id,
                          )}
                          onChange={(e) => {
                            const nextId = product._id || product.id;
                            setSelectedProductIds((current) =>
                              e.target.checked
                                ? [...current, nextId]
                                : current.filter((id) => id !== nextId),
                            );
                          }}
                          aria-label={`Seleccionar ${product.name}`}
                          style={{
                            width: 16,
                            height: 16,
                            accentColor: "var(--green)",
                            cursor: "pointer",
                          }}
                        />
                      </td>
                      <td style={td}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              width: 60,
                              height: 72,
                              borderRadius: 8,
                              overflow: "hidden",
                              border: "1px solid var(--ink-06)",
                              flexShrink: 0,
                            }}
                          >
                            <ProductImage product={product} size="xs" />
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                              }}
                            >
                              {product.name}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--ink-60)",
                                fontFamily: '"JetBrains Mono", monospace',
                              }}
                            >
                              {product.brand}
                            </div>
                            {variantInfo && (
                              <div
                                style={{
                                  fontSize: 10,
                                  color: "var(--ink-40)",
                                  fontFamily: '"JetBrains Mono", monospace',
                                  marginTop: 2,
                                }}
                              >
                                {variantInfo.count} {variantInfo.label}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ ...td, fontSize: 12 }}>
                        {product.category}
                      </td>
                      <td style={td}>
                        <div
                          style={{
                            fontFamily: '"Instrument Serif", serif',
                            fontSize: 18,
                          }}
                        >
                          ${getEffectivePrice(product).toFixed(2)}
                        </div>
                        {getEffectivePriceBefore(product) && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--ink-40)",
                              textDecoration: "line-through",
                              fontFamily: '"JetBrains Mono", monospace',
                            }}
                          >
                            ${getEffectivePriceBefore(product)!.toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td
                        style={{
                          ...td,
                          fontFamily: '"JetBrains Mono", monospace',
                        }}
                      >
                        {getTotalStock(product)}
                      </td>
                      <td style={td}>
                        <ProductRatingCell summary={reviewsSummary[product.id]} />
                      </td>
                      <td style={td}>
                        <StatusPill
                          status={product.active ? "Activo" : "Inactivo"}
                        />
                      </td>
                      <td style={td}>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                          }}
                        >
                          <button
                            style={iconBtnAd}
                            title="Editar producto"
                            onClick={() =>
                              setProductModal({
                                mode: "edit",
                                product,
                              })
                            }
                          >
                            <Icon name="pencil" size={14} />
                          </button>
                          <button
                            style={{
                              ...iconBtnAd,
                              color: "oklch(0.55 0.15 30)",
                            }}
                            title="Eliminar producto"
                            onClick={() => {
                              setDeleteError(null);
                              setConfirmDeleteId(product._id || product.id);
                            }}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {displayedProducts.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        style={{
                          ...td,
                          textAlign: "center",
                          color: "var(--ink-60)",
                          padding: "48px 24px",
                        }}
                      >
                        No hay productos para los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
              <PaginationControls
                page={paginatedProducts.page}
                totalPages={paginatedProducts.totalPages}
                totalItems={displayedProducts.length}
                start={paginatedProducts.start}
                end={paginatedProducts.end}
                onPageChange={setProductsPage}
              />
            </Card>

            <ProductModal
              open={!!productModal}
              mode={productModal?.mode ?? "add"}
              product={productModal?.product}
              categories={categories}
              highlightVariantId={highlightVariantId}
              onClose={() => setProductModal(null)}
              onSave={(data) => {
                if (productModal?.mode === "add") {
                  productCreateMutation.mutate(data);
                } else if (productModal?.product) {
                  productUpdateMutation.mutate({
                    mongoId: productModal.product._id,
                    data,
                  });
                }
              }}
              saving={isSaving}
              error={
                (productCreateMutation.error as Error)?.message ||
                (productUpdateMutation.error as Error)?.message
              }
            />

            <ModalOverlay open={!!confirmDeleteId} onClose={() => { setConfirmDeleteId(null); setDeleteError(null); }} zIndex={110} overlayColor="rgba(17, 24, 20, 0.28)">
                <div
                  style={{
                    width: "100%",
                    maxWidth: 420,
                    background: "var(--cream)",
                    border: "1px solid var(--ink-06)",
                    borderRadius: 24,
                    boxShadow: "0 28px 80px -36px rgba(0,0,0,0.32)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "22px 24px 18px",
                      borderBottom: "1px solid var(--ink-06)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: '"JetBrains Mono", monospace',
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: "var(--ink-60)",
                        marginBottom: 8,
                      }}
                    >
                      Confirmación
                    </div>
                    <div
                      style={{
                        fontFamily: '"Instrument Serif", serif',
                        fontSize: 32,
                        lineHeight: 1,
                        letterSpacing: "-0.03em",
                        color: "var(--ink)",
                      }}
                    >
                      Eliminar{" "}
                      <em
                        style={{
                          color: "oklch(0.5 0.15 30)",
                        }}
                      >
                        producto
                      </em>
                    </div>
                    <p
                      style={{
                        margin: "12px 0 0",
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: "var(--ink-80)",
                        fontFamily: '"Geist", sans-serif',
                      }}
                    >
                      Esta acción eliminará el producto del catálogo. No se
                      puede deshacer.
                    </p>
                    {deleteError && (
                      <div
                        style={{
                          marginTop: 12,
                          fontSize: 12,
                          color: "oklch(0.5 0.15 30)",
                          fontFamily: '"Geist", sans-serif',
                        }}
                      >
                        {deleteError}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      padding: 24,
                      display: "flex",
                      gap: 10,
                      justifyContent: "flex-end",
                      background: "var(--cream-2)",
                    }}
                  >
                    <AnimatedButton variant="outline" onClick={() => { setConfirmDeleteId(null); setDeleteError(null); }} text="Cancelar" />
                    <AnimatedButton variant="primary" onClick={() => { setDeleteError(null); productDeleteMutation.mutate(confirmDeleteId!); }} disabled={productDeleteMutation.isPending} text={productDeleteMutation.isPending ? "Eliminando…" : "Sí, eliminar"} />
                  </div>
                </div>
            </ModalOverlay>

            <ModalOverlay open={!!confirmBulkDelete} onClose={() => { setConfirmBulkDelete(null); setDeleteError(null); }} zIndex={111} overlayColor="rgba(17, 24, 20, 0.28)">
                <div
                  style={{
                    width: "100%",
                    maxWidth: 440,
                    background: "var(--cream)",
                    border: "1px solid var(--ink-06)",
                    borderRadius: 24,
                    boxShadow: "0 28px 80px -36px rgba(0,0,0,0.32)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "22px 24px 18px",
                      borderBottom: "1px solid var(--ink-06)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: '"JetBrains Mono", monospace',
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: "var(--ink-60)",
                        marginBottom: 8,
                      }}
                    >
                      Confirmación
                    </div>
                    <div
                      style={{
                        fontFamily: '"Instrument Serif", serif',
                        fontSize: 32,
                        lineHeight: 1,
                        letterSpacing: "-0.03em",
                        color: "var(--ink)",
                      }}
                    >
                      {confirmBulkDelete?.title}
                    </div>
                    <p
                      style={{
                        margin: "12px 0 0",
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: "var(--ink-80)",
                        fontFamily: '"Geist", sans-serif',
                      }}
                    >
                      {confirmBulkDelete?.description}
                    </p>
                    {deleteError && (
                      <div
                        style={{
                          marginTop: 12,
                          fontSize: 12,
                          color: "oklch(0.5 0.15 30)",
                          fontFamily: '"Geist", sans-serif',
                        }}
                      >
                        {deleteError}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      padding: 24,
                      display: "flex",
                      gap: 10,
                      justifyContent: "flex-end",
                      background: "var(--cream-2)",
                    }}
                  >
                    <AnimatedButton variant="outline" onClick={() => { setConfirmBulkDelete(null); setDeleteError(null); }} text="Cancelar" />
                    <AnimatedButton variant="primary" onClick={() => { setDeleteError(null); if (confirmBulkDelete) bulkDeleteMutation.mutate(confirmBulkDelete.ids); }} disabled={bulkDeleteMutation.isPending} text={bulkDeleteMutation.isPending ? "Eliminando…" : "Sí, eliminar"} />
                  </div>
                </div>
            </ModalOverlay>

            <ModalOverlay open={confirmDeleteAll} onClose={() => { setConfirmDeleteAll(false); setDeleteError(null); }} zIndex={111} overlayColor="rgba(17, 24, 20, 0.28)">
                <div
                  style={{
                    width: "100%",
                    maxWidth: 440,
                    background: "var(--cream)",
                    border: "1px solid var(--ink-06)",
                    borderRadius: 24,
                    boxShadow: "0 28px 80px -36px rgba(0,0,0,0.32)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "22px 24px 18px",
                      borderBottom: "1px solid var(--ink-06)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: '"JetBrains Mono", monospace',
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: "var(--coral)",
                        marginBottom: 8,
                      }}
                    >
                      Peligro
                    </div>
                    <div
                      style={{
                        fontFamily: '"Instrument Serif", serif',
                        fontSize: 32,
                        lineHeight: 1,
                        letterSpacing: "-0.03em",
                        color: "var(--ink)",
                      }}
                    >
                      Eliminar todo el catálogo
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "18px 24px",
                      borderBottom: "1px solid var(--ink-06)",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 15,
                        lineHeight: 1.6,
                        color: "var(--ink-60)",
                      }}
                    >
                      ¿Estás seguro de que deseas eliminar{" "}
                      <strong>todos los productos</strong> del catálogo? Esta
                      acción no se puede deshacer.
                    </p>
                  </div>
                  <div
                    style={{
                      padding: "16px 24px",
                      display: "flex",
                      gap: 10,
                      justifyContent: "flex-end",
                    }}
                  >
                    <AnimatedButton variant="outline" onClick={() => { setConfirmDeleteAll(false); setDeleteError(null); }} text="Cancelar" />
                    <AnimatedButton variant="primary" onClick={() => { setDeleteError(null); deleteAllMutation.mutate(); }} disabled={deleteAllMutation.isPending} text={deleteAllMutation.isPending ? "Eliminando…" : "Sí, eliminar todo"} />
                  </div>
                </div>
            </ModalOverlay>

            <ModalOverlay open={!!confirmUserDelete} onClose={() => setConfirmUserDelete(null)} zIndex={112} overlayColor="rgba(17, 24, 20, 0.28)">
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "100%",
                    maxWidth: 420,
                    background: "var(--cream)",
                    border: "1px solid var(--ink-06)",
                    borderRadius: 24,
                    boxShadow: "0 28px 80px -36px rgba(0,0,0,0.32)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "22px 24px 18px",
                      borderBottom: "1px solid var(--ink-06)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: '"JetBrains Mono", monospace',
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: "var(--ink-60)",
                        marginBottom: 8,
                      }}
                    >
                      Confirmación
                    </div>
                    <div
                      style={{
                        fontFamily: '"Instrument Serif", serif',
                        fontSize: 32,
                        lineHeight: 1,
                        letterSpacing: "-0.03em",
                        color: "var(--ink)",
                      }}
                    >
                      Eliminar{" "}
                      <em
                        style={{
                          color: "oklch(0.5 0.15 30)",
                        }}
                      >
                        usuario
                      </em>
                    </div>
                    <p
                      style={{
                        margin: "12px 0 0",
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: "var(--ink-80)",
                        fontFamily: '"Geist", sans-serif',
                      }}
                    >
                      ¿Eliminar a {confirmUserDelete?.name}? Esto eliminará su
                      cuenta local. El usuario seguirá existiendo en Clerk.
                    </p>
                  </div>
                  <div
                    style={{
                      padding: 24,
                      display: "flex",
                      gap: 10,
                      justifyContent: "flex-end",
                      background: "var(--cream-2)",
                    }}
                  >
                    <AnimatedButton variant="outline" onClick={() => setConfirmUserDelete(null)} text="Cancelar" />
                    <AnimatedButton variant="primary" onClick={() => confirmUserDelete && userDeleteMutation.mutate(confirmUserDelete.id)} disabled={userDeleteMutation.isPending} style={{ background: "oklch(0.5 0.15 30)" }} text={userDeleteMutation.isPending ? "Eliminando…" : "Sí, eliminar"} />
                  </div>
                </div>
            </ModalOverlay>
          </>
    </>
  );
}
