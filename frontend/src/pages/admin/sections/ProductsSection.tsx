import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Checkbox } from '../../../components/shared/Checkbox';
import { Select } from '../../../components/shared/Select';
import { PaginationControls } from '../components/PaginationControls';
import { ProductModal } from '../components/ProductModal';
import { useAdminPanelContext } from '../AdminPanelContext';
import { variantSummary } from '../utils';
import type { ProductSortKey } from '../hooks/useAdminPanel';
import { getTotalStock, getEffectivePrice, getEffectivePriceBefore } from '../../../lib/productVariants';
import { api } from '../../../lib/api';
import { formatCurrency } from '../../../lib/currency';
import { effectiveLowStockThreshold } from '../types';
import type { Product } from '../../../types';

const modalFieldLabel = { fontSize: 11, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--ink-60)', marginBottom: 6, display: 'block' };
const modalInput = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--ink-20)', background: 'var(--cream)', fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink)', boxSizing: 'border-box' as const };

function ButtonSpinner() {
  return (
    <>
      <span
        style={{
          display: 'inline-block',
          width: 13,
          height: 13,
          borderRadius: '50%',
          border: '2px solid currentColor',
          borderTopColor: 'transparent',
          opacity: 0.85,
          animation: 'admin-btn-spin 0.6s linear infinite',
        }}
      />
      <style>{'@keyframes admin-btn-spin { to { transform: rotate(360deg); } }'}</style>
    </>
  );
}

function SampleSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [maxPrice, setMaxPrice] = useState('');
  const [pointsPerDollar, setPointsPerDollar] = useState('');
  const [pointValueCents, setPointValueCents] = useState('');
  const [message, setMessage] = useState('');

  const settingsQuery = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => api.admin.settings.get((await getToken())!),
    enabled: open,
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setMaxPrice(String(settingsQuery.data.sampleMaxPrice));
    setPointsPerDollar(String(settingsQuery.data.loyaltyPointsPerDollar ?? 1));
    setPointValueCents(String(settingsQuery.data.loyaltyPointValueCents ?? 1));
  }, [settingsQuery.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return api.admin.settings.update(
        {
          sampleMaxPrice: parseFloat(maxPrice) || 0,
          loyaltyPointsPerDollar: parseFloat(pointsPerDollar) || 0,
          loyaltyPointValueCents: parseFloat(pointValueCents) || 0,
        },
        token!,
      );
    },
    onSuccess: () => {
      setMessage(t('admin.products.sampleSettingsModal.updated'));
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
  });

  return (
    <ModalOverlay open={open} onClose={onClose}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 20, padding: 24 }}>
        <h3 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 24, margin: '0 0 8px' }}>Club Healthora</h3>

        <p style={{ fontSize: 13, color: 'var(--ink-60)', margin: '16px 0 8px', lineHeight: 1.5, fontWeight: 600 }}>{t('admin.products.sampleSettingsModal.freeSampleTitle')}</p>
        <p style={{ fontSize: 13, color: 'var(--ink-60)', margin: '0 0 12px', lineHeight: 1.5 }}>
          {t('admin.products.sampleSettingsModal.freeSampleBody')}
        </p>
        <label style={modalFieldLabel}>{t('admin.products.sampleSettingsModal.maxPriceLabel')}</label>
        <input
          type="number"
          min={0}
          step="0.01"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          style={modalInput}
        />

        <p style={{ fontSize: 13, color: 'var(--ink-60)', margin: '20px 0 8px', lineHeight: 1.5, fontWeight: 600 }}>{t('admin.products.sampleSettingsModal.loyaltyTitle')}</p>
        <p style={{ fontSize: 13, color: 'var(--ink-60)', margin: '0 0 12px', lineHeight: 1.5 }}>
          {t('admin.products.sampleSettingsModal.loyaltyBody')}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={modalFieldLabel}>{t('admin.products.sampleSettingsModal.pointsPerDollarLabel')}</label>
            <input
              type="number"
              min={0}
              step="0.1"
              value={pointsPerDollar}
              onChange={(e) => setPointsPerDollar(e.target.value)}
              style={modalInput}
            />
          </div>
          <div>
            <label style={modalFieldLabel}>{t('admin.products.sampleSettingsModal.pointValueLabel')}</label>
            <input
              type="number"
              min={0}
              step="0.1"
              value={pointValueCents}
              onChange={(e) => setPointValueCents(e.target.value)}
              style={modalInput}
            />
          </div>
        </div>

        {message && <p style={{ fontSize: 13, color: 'var(--green)', marginTop: 12 }}>{message}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 16px', borderRadius: 999, background: 'transparent', border: '1px solid var(--ink-12)', color: 'var(--ink)', cursor: 'pointer', fontSize: 13, fontFamily: '"Geist", sans-serif' }}>
            {t('admin.products.sampleSettingsModal.close')}
          </button>
          <AnimatedButton
            variant="primary"
            onClick={() => saveMut.mutate()}
            text={saveMut.isPending ? t('admin.products.sampleSettingsModal.saving') : t('admin.products.sampleSettingsModal.save')}
          />
        </div>
      </div>
    </ModalOverlay>
  );
}

function CategoryDiscountModal({ open, onClose, categories, products }: { open: boolean; onClose: () => void; categories: string[]; products: Product[] }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('10');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [message, setMessage] = useState('');
  const invalidRange = Boolean(startsAt && endsAt && endsAt < startsAt);

  // "Con descuento activo" = tiene al menos un producto/variante/combo marcado por el propio
  // descuento por categoría (categoryDiscount), sin importar si su vigencia ya venció - el precio
  // sigue siendo el descontado hasta que se quite explícitamente. Para que el admin sepa de
  // antemano, antes de aplicar/quitar, si esa categoría ya tiene uno corriendo.
  const categoriesWithDiscount = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      const hasDiscount = p.categoryDiscount || p.variants?.some((v) => v.categoryDiscount);
      if (hasDiscount) set.add(p.category);
    }
    return categories.filter((c) => set.has(c));
  }, [products, categories]);

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
      setMessage(t('admin.products.categoryDiscountModal.applySuccess', { updated: data.updated, total: data.total, count: data.total }));
      invalidate();
    },
  });

  const removeMut = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return api.admin.products.removeCategoryDiscount(category, token!);
    },
    onSuccess: (data) => {
      setMessage(t('admin.products.categoryDiscountModal.removeSuccess', { count: data.updated }));
      invalidate();
    },
  });

  return (
    <ModalOverlay open={open} onClose={onClose}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--cream)', border: '1px solid var(--ink-06)', borderRadius: 20, padding: 24 }}>
        <h3 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 24, margin: '0 0 16px' }}>{t('admin.products.categoryDiscountModal.title')}</h3>
        {categoriesWithDiscount.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={modalFieldLabel}>{t('admin.products.categoryDiscountModal.activeDiscountLabel')}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {categoriesWithDiscount.map((c) => {
                const selected = category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setCategory(c); setMessage(''); }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 12px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontFamily: '"Geist", sans-serif',
                      cursor: 'pointer',
                      border: '1px solid ' + (selected ? 'var(--green)' : 'var(--ink-20)'),
                      background: selected ? 'var(--green)' : 'transparent',
                      color: selected ? 'var(--cream)' : 'var(--ink)',
                      transition: 'all 120ms',
                    }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: 999, background: selected ? 'var(--cream)' : 'var(--green)' }} />
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ marginBottom: 14 }}>
          <label style={modalFieldLabel}>{t('admin.products.categoryDiscountModal.categoryLabel')}</label>
          <Select value={category} onChange={(e) => { setCategory(e.target.value); setMessage(''); }}>
            <option value="">{t('admin.products.categoryDiscountModal.categoryPlaceholder')}</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={modalFieldLabel}>{t('admin.products.categoryDiscountModal.typeLabel')}</label>
            <Select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}>
              <option value="percent">{t('admin.products.categoryDiscountModal.typePercent')}</option>
              <option value="fixed">{t('admin.products.categoryDiscountModal.typeFixed')}</option>
            </Select>
          </div>
          <div>
            <label style={modalFieldLabel}>{t('admin.products.categoryDiscountModal.valueLabel')}</label>
            <input style={modalInput} type="number" min={0} step={0.01} value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
          <div>
            <label style={modalFieldLabel}>{t('admin.variantsMatrixEditor.validFromOptional')}</label>
            <DateInputDDMMYYYY style={modalInput} value={startsAt} onChange={setStartsAt} />
          </div>
          <div>
            <label style={modalFieldLabel}>{t('admin.variantsMatrixEditor.validUntilOptional')}</label>
            <DateInputDDMMYYYY style={modalInput} value={endsAt} onChange={setEndsAt} />
          </div>
        </div>
        {invalidRange && <div role="alert" style={{ marginBottom: 14, fontSize: 13, color: 'var(--coral)' }}>{t('admin.products.categoryDiscountModal.invalidRange')}</div>}
        {message && <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--green)' }}>{message}</div>}
        {(applyMut.isError || removeMut.isError) && <div role="alert" style={{ marginBottom: 14, fontSize: 13, color: 'var(--coral)' }}>{t('admin.products.categoryDiscountModal.genericError')}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <AnimatedButton
            variant="outline"
            size="sm"
            style={{ color: 'var(--coral)', borderColor: 'oklch(0.85 0.08 30)' }}
            disabled={!category || removeMut.isPending}
            onClick={() => removeMut.mutate()}
            text={removeMut.isPending ? t('admin.products.categoryDiscountModal.removing') : t('admin.products.categoryDiscountModal.removeButton')}
            icon={removeMut.isPending ? <ButtonSpinner /> : undefined}
          />
          <AnimatedButton
            variant="primary"
            disabled={!category || (parseFloat(value) || 0) <= 0 || invalidRange || applyMut.isPending}
            onClick={() => applyMut.mutate()}
            text={applyMut.isPending ? t('admin.products.categoryDiscountModal.applying') : t('admin.products.categoryDiscountModal.applyButton')}
            icon={applyMut.isPending ? <ButtonSpinner /> : undefined}
          />
        </div>
      </div>
    </ModalOverlay>
  );
}

function ProductRatingCell({ summary }: { summary?: { avgRating: number; count: number } }) {
  const { t } = useTranslation();
  if (!summary || summary.count === 0) {
    return (
      <span style={{ fontSize: 10, color: 'var(--ink-40)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
        {t('admin.products.table.noReviews')}
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
  const { t } = useTranslation();
  const PRODUCT_SORT_LABEL: Record<ProductSortKey, string> = {
    price: t('admin.products.table.columns.price'),
    stock: t('admin.products.table.columns.stock'),
    rating: t('admin.products.table.columns.rating'),
    active: t('admin.products.table.columns.status'),
  };
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
  const [sampleSettingsModalOpen, setSampleSettingsModalOpen] = useState(false);
  const { getToken } = useAuth();
  const reindexMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error(t('admin.products.sessionExpiredError'));
      return api.admin.catalog.reindex(token);
    },
  });

  return (
    <>
          <>
            <PageHeader
              loading={showProductsSkeleton}
              kicker={
                showProductsSkeleton
                  ? undefined
                  : t('admin.products.kicker', { count: products.length })
              }
              title={
                <>
                  {t('admin.products.titlePrefix')}{" "}
                  <em style={{ color: "var(--green)" }}>{t('admin.products.titleEmphasis')}</em>
                </>
              }
              sub={t('admin.products.sub')}
              actions={
                showProductsSkeleton ? (
                  <Skeleton height={40} width={152} borderRadius={999} />
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => reindexMutation.mutate()}
                      disabled={reindexMutation.isPending}
                      style={{ padding: "10px 16px", borderRadius: 999, background: "transparent", border: "1px solid var(--ink-12)", color: "var(--ink)", cursor: "pointer", fontSize: 13, fontFamily: '"Geist", sans-serif', whiteSpace: "nowrap" }}
                    >
                      {reindexMutation.isPending ? t('admin.products.refreshing') : t('admin.products.refreshCatalog')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountModalOpen(true)}
                      style={{ padding: "10px 16px", borderRadius: 999, background: "transparent", border: "1px solid var(--ink-12)", color: "var(--ink)", cursor: "pointer", fontSize: 13, fontFamily: '"Geist", sans-serif', whiteSpace: "nowrap" }}
                    >
                      {t('admin.products.categoryDiscountButton')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSampleSettingsModalOpen(true)}
                      style={{ padding: "10px 16px", borderRadius: 999, background: "transparent", border: "1px solid var(--ink-12)", color: "var(--ink)", cursor: "pointer", fontSize: 13, fontFamily: '"Geist", sans-serif', whiteSpace: "nowrap" }}
                    >
                      {t('admin.products.clubHealthoraButton')}
                    </button>
                    <AnimatedButton variant="primary" onClick={() => setProductModal({ mode: "add" })} text={t('admin.products.addProductButton')} />
                  </>
                )
              }
            />
            <CategoryDiscountModal open={discountModalOpen} onClose={() => setDiscountModalOpen(false)} categories={categories} products={products} />
            <SampleSettingsModal open={sampleSettingsModalOpen} onClose={() => setSampleSettingsModalOpen(false)} />

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
                    placeholder={t('admin.products.searchPlaceholder')}
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
                      <span>{cat === 'Todos' ? t('catalog.filters.all') : cat}</span>
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
                    <span>
                      {status === 'Todos'
                        ? t('catalog.filters.all')
                        : status === 'Activo'
                          ? t('admin.products.filters.statusActive')
                          : t('admin.products.filters.statusInactive')}
                    </span>
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
                      ? t('admin.products.selectedInView', { count: selectedDisplayedIds.length })
                      : t('admin.products.selectHint')}
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
                    text={t('admin.products.clearSelection')}
                  />
                  <AnimatedButton
                    variant="outline"
                    onClick={() => setConfirmBulkDelete({ ids: selectedDisplayedIds, title: t('admin.products.deleteSelected'), description: t('admin.products.deleteSelectedDescription', { count: selectedDisplayedIds.length }) })}
                    disabled={selectedDisplayedIds.length === 0}
                    style={{ color: "oklch(0.5 0.15 30)", borderColor: "oklch(0.85 0.08 30)" }}
                    text={t('admin.products.deleteSelected')}
                  />
                  <AnimatedButton
                    variant="outline"
                    onClick={() => setConfirmDeleteAll(true)}
                    style={{ color: "var(--coral)", borderColor: "oklch(0.85 0.08 30)" }}
                    text={t('admin.products.deleteAllButton')}
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
                      <Checkbox
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
                        aria-label={t('admin.products.table.selectVisibleAria')}
                        style={{ width: 16, height: 16, minWidth: 16 }}
                      />
                    </th>
                    <th style={th}>{t('admin.products.table.columns.product')}</th>
                    <th style={th}>{t('admin.products.table.columns.category')}</th>
                    <SortableTh label={t('admin.products.table.columns.price')} sortKey="price" activeSort={productSort} onSort={toggleProductSort} />
                    <SortableTh label={t('admin.products.table.columns.stock')} sortKey="stock" activeSort={productSort} onSort={toggleProductSort} />
                    <SortableTh label={t('admin.products.table.columns.rating')} sortKey="rating" activeSort={productSort} onSort={toggleProductSort} />
                    <SortableTh label={t('admin.products.table.columns.status')} sortKey="active" activeSort={productSort} onSort={toggleProductSort} />
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.items.map((product) => {
                    const variantInfo = variantSummary(product);
                    return (
                    <tr key={product.id} style={trStyle}>
                      <td style={{ ...td, width: 52 }}>
                        <Checkbox
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
                          aria-label={t('admin.products.table.selectProductAria', { name: product.name })}
                          style={{ width: 16, height: 16, minWidth: 16 }}
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
                                {t(`admin.products.variantSummary.${variantInfo.kind}`, { count: variantInfo.count })}
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
                          {formatCurrency(getEffectivePrice(product))}
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
                            {formatCurrency(getEffectivePriceBefore(product)!)}
                          </div>
                        )}
                      </td>
                      <td
                        style={{
                          ...td,
                          fontFamily: '"JetBrains Mono", monospace',
                          ...(product.active && getTotalStock(product) <= effectiveLowStockThreshold(product)
                            ? { color: 'var(--coral)', fontWeight: 600 }
                            : {}),
                        }}
                      >
                        {getTotalStock(product)}
                        {product.active && getTotalStock(product) <= effectiveLowStockThreshold(product) && (
                          <span
                            title={t('admin.products.table.lowStockTitle', { threshold: effectiveLowStockThreshold(product) })}
                            style={{
                              marginLeft: 6,
                              fontSize: 9,
                              fontFamily: '"JetBrains Mono", monospace',
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: 999,
                              background: 'color-mix(in oklab, var(--coral) 12%, white)',
                              color: 'var(--coral)',
                            }}
                          >
                            {t('admin.products.table.lowStockBadge')}
                          </span>
                        )}
                      </td>
                      <td style={td}>
                        <ProductRatingCell summary={reviewsSummary[product.id]} />
                      </td>
                      <td style={td}>
                        <StatusPill
                          status={product.active ? "Activo" : "Inactivo"}
                          label={product.active ? t('admin.products.filters.statusActive') : t('admin.products.filters.statusInactive')}
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
                            title={t('admin.products.table.editTitle')}
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
                            title={t('admin.products.table.deleteTitle')}
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
                        {t('admin.products.table.empty')}
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
                      {t('admin.products.confirmKicker')}
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
                      {t('admin.products.deleteModal.titlePrefix')}{" "}
                      <em
                        style={{
                          color: "oklch(0.5 0.15 30)",
                        }}
                      >
                        {t('admin.products.deleteModal.titleEmphasis')}
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
                      {t('admin.products.deleteModal.body')}
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
                    <AnimatedButton variant="outline" onClick={() => { setConfirmDeleteId(null); setDeleteError(null); }} text={t('admin.products.cancel')} />
                    <AnimatedButton variant="primary" onClick={() => { setDeleteError(null); productDeleteMutation.mutate(confirmDeleteId!); }} disabled={productDeleteMutation.isPending} text={productDeleteMutation.isPending ? t('admin.products.deleting') : t('admin.products.confirmDelete')} />
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
                      {t('admin.products.confirmKicker')}
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
                    <AnimatedButton variant="outline" onClick={() => { setConfirmBulkDelete(null); setDeleteError(null); }} text={t('admin.products.cancel')} />
                    <AnimatedButton variant="primary" onClick={() => { setDeleteError(null); if (confirmBulkDelete) bulkDeleteMutation.mutate(confirmBulkDelete.ids); }} disabled={bulkDeleteMutation.isPending} text={bulkDeleteMutation.isPending ? t('admin.products.deleting') : t('admin.products.confirmDelete')} />
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
                      {t('admin.products.deleteAllModal.dangerKicker')}
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
                      {t('admin.products.deleteAllModal.title')}
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
                      {t('admin.products.deleteAllModal.bodyPrefix')}{" "}
                      <strong>{t('admin.products.deleteAllModal.bodyStrong')}</strong> {t('admin.products.deleteAllModal.bodySuffix')}
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
                    <AnimatedButton variant="outline" onClick={() => { setConfirmDeleteAll(false); setDeleteError(null); }} text={t('admin.products.cancel')} />
                    <AnimatedButton variant="primary" onClick={() => { setDeleteError(null); deleteAllMutation.mutate(); }} disabled={deleteAllMutation.isPending} text={deleteAllMutation.isPending ? t('admin.products.deleting') : t('admin.products.deleteAllModal.confirmAll')} />
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
                      {t('admin.products.confirmKicker')}
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
                      {t('admin.products.deleteUserModal.titlePrefix')}{" "}
                      <em
                        style={{
                          color: "oklch(0.5 0.15 30)",
                        }}
                      >
                        {t('admin.products.deleteUserModal.titleEmphasis')}
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
                      {t('admin.products.deleteUserModal.body', { name: confirmUserDelete?.name })}
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
                    <AnimatedButton variant="outline" onClick={() => setConfirmUserDelete(null)} text={t('admin.products.cancel')} />
                    <AnimatedButton variant="primary" onClick={() => confirmUserDelete && userDeleteMutation.mutate(confirmUserDelete.id)} disabled={userDeleteMutation.isPending} style={{ background: "oklch(0.5 0.15 30)" }} text={userDeleteMutation.isPending ? t('admin.products.deleting') : t('admin.products.confirmDelete')} />
                  </div>
                </div>
            </ModalOverlay>
          </>
    </>
  );
}
