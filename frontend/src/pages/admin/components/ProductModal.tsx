import { type ChangeEvent, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../../../types';
import { DateInputDDMMYYYY, iconBtnAd } from '../../../components/admin';
import { AnimatedButton } from '../../../components/shared/AnimatedButton';
import { Icon } from '../../../components/shared/Icon';
import { ModalOverlay } from '../../../components/shared/ModalOverlay';
import { Select } from '../../../components/shared/Select';
import { DEFAULT_LOW_STOCK_THRESHOLD, emptyForm, type ProductForm } from '../types';
import { formToPayload, productToForm } from '../utils';
import { FormattedTextarea } from './FormattedTextarea';
import { ImageDropZone } from './ImageDropZone';
import { ProductVariantsMatrixEditor } from './ProductVariantsMatrixEditor';
import { slugify } from '../utils';
import { cellKey, getVariantTab } from '../variantMatrix';
import { translatedCategoryLabel } from '../../../lib/categoryLabels';

export function ProductModal({
  open,
  mode,
  product,
  categories,
  highlightVariantId,
  onClose,
  onSave,
  saving,
  error,
}: {
  open: boolean;
  mode: "add" | "edit";
  product?: Product;
  categories: string[];
  /** Set from a low-stock notification's deep link - scrolls to and briefly highlights the exact
   * variant/combo row (matches `data-variant-anchor` on the variant/matrix editors) so the admin
   * doesn't have to hunt for it among the product's other variants. */
  highlightVariantId?: string | null;
  onClose: () => void;
  onSave: (data: Partial<Product>) => void;
  saving: boolean;
  error?: string | null;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<ProductForm>(() =>
    product ? productToForm(product) : { ...emptyForm },
  );
  const [validationError, setValidationError] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setForm(product ? productToForm(product) : { ...emptyForm });
      setValidationError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !highlightVariantId) return;
    // Wait a tick for the variant editor (matrix/simple) to render its rows off the freshly-set
    // form state before querying the DOM.
    const timer = window.setTimeout(() => {
      const target = contentRef.current?.querySelector<HTMLElement>(
        `[data-variant-anchor="${highlightVariantId}"]`,
      );
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("admin-variant-highlight");
      const clear = window.setTimeout(() => target.classList.remove("admin-variant-highlight"), 2600);
      return () => window.clearTimeout(clear);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [open, highlightVariantId]);

  const setF =
    (key: keyof ProductForm) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setSelect =
    (key: keyof ProductForm) => (e: ChangeEvent<HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setVal = (key: keyof ProductForm) => (v: string) =>
    setForm((prev) => ({ ...prev, [key]: v }));

  const variantTab = getVariantTab(form.variantsMode, form.variantsSimple.length);
  const usesGenericFields = variantTab === "none";

  const handleSave = () => {
    if (!form.name.trim()) {
      setValidationError(t('admin.productModal.validation.nameRequired'));
      return;
    }
    if (!form.brand.trim()) {
      setValidationError(t('admin.productModal.validation.brandRequired'));
      return;
    }
    if (!form.category.trim()) {
      setValidationError(t('admin.productModal.validation.categoryRequired'));
      return;
    }
    if (!form.short.trim()) {
      setValidationError(t('admin.productModal.validation.shortRequired'));
      return;
    }
    if (usesGenericFields && (parseFloat(form.price) || 0) <= 0) {
      setValidationError(t('admin.productModal.validation.priceMustBePositive'));
      return;
    }
    if (usesGenericFields && (parseInt(form.stock) || 0) <= 0) {
      setValidationError(t('admin.productModal.validation.stockMustBePositive'));
      return;
    }
    if (variantTab === "simple") {
      for (const row of form.variantsSimple) {
        if (!row.label.trim()) {
          setValidationError(t('admin.productModal.validation.variantNeedsLabel'));
          return;
        }
        if ((parseFloat(row.price) || 0) <= 0) {
          setValidationError(t('admin.productModal.validation.variantNeedsPrice', { label: row.label.trim() }));
          return;
        }
        if ((parseInt(row.stock, 10) || 0) <= 0) {
          setValidationError(t('admin.productModal.validation.variantNeedsStock', { label: row.label.trim() }));
          return;
        }
        if (row.images.length === 0) {
          setValidationError(t('admin.productModal.validation.variantNeedsImage', { label: row.label.trim() }));
          return;
        }
      }
    } else if (variantTab === "matrix") {
      if (form.variantsMatrix.primary.length === 0) {
        setValidationError(t('admin.productModal.validation.matrixNeedsPrimary'));
        return;
      }
      if (form.variantsMatrix.sizes.length === 0) {
        setValidationError(t('admin.productModal.validation.matrixNeedsSize'));
        return;
      }
      for (const row of form.variantsMatrix.primary) {
        if (!row.label.trim()) {
          setValidationError(t('admin.productModal.validation.primaryNeedsLabel'));
          return;
        }
      }
      for (const row of form.variantsMatrix.sizes) {
        if (!row.label.trim()) {
          setValidationError(t('admin.productModal.validation.sizeNeedsLabel'));
          return;
        }
        if ((parseFloat(row.price) || 0) <= 0) {
          setValidationError(t('admin.productModal.validation.sizeNeedsPrice', { label: row.label.trim() }));
          return;
        }
        if ((parseInt(row.stock, 10) || 0) <= 0) {
          setValidationError(t('admin.productModal.validation.sizeNeedsStock', { label: row.label.trim() }));
          return;
        }
      }
      for (const p of form.variantsMatrix.primary) {
        for (const s of form.variantsMatrix.sizes) {
          const cell = form.variantsMatrix.cells[cellKey(p.key, s.key)];
          if (!cell?.active) continue;
          // A combo's own image is optional when it hasn't overridden the sabor/color row's
          // images - those are the fallback shown to shoppers for every size of that sabor (see
          // resolveVariantImage / getDefaultComboImage). But once the combo has its own override
          // (imagesTouched), that override is authoritative even if the user emptied it out -
          // falling back to `p.images.length > 0` here would let an explicitly-emptied combo save
          // with zero images just because the sabor happens to still have its own photos.
          const effectiveLength = cell.imagesTouched ? cell.images.length : p.images.length;
          if (effectiveLength === 0) {
            setValidationError(
              t('admin.productModal.validation.comboNeedsImage', { primary: p.label.trim(), size: s.label.trim() }),
            );
            return;
          }
        }
      }
    }
    if (usesGenericFields && !form.imageUrl.trim()) {
      setValidationError(t('admin.productModal.validation.image1Required'));
      return;
    }
    if (usesGenericFields && form.priceBefore && form.discountStartsAt && form.discountEndsAt && form.discountEndsAt < form.discountStartsAt) {
      setValidationError(t('admin.products.categoryDiscountModal.invalidRange'));
      return;
    }
    if (variantTab === "simple") {
      for (const row of form.variantsSimple) {
        if (row.priceBefore && row.discountStartsAt && row.discountEndsAt && row.discountEndsAt < row.discountStartsAt) {
          setValidationError(t('admin.productModal.validation.variantDateRange', { label: row.label.trim() }));
          return;
        }
      }
    }
    for (const tab of form.extraTabs) {
      if (Boolean(tab.label.trim()) !== Boolean(tab.content.trim())) {
        setValidationError(t('admin.productModal.validation.extraTabIncomplete'));
        return;
      }
    }
    setValidationError("");
    onSave(formToPayload(form));
  };

  const inputS: CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--ink-20)",
    background: "var(--cream-2)",
    fontSize: 13,
    fontFamily: '"Geist", sans-serif',
    color: "var(--ink)",
    boxSizing: "border-box",
    outline: "none",
  };
  const labelS: CSSProperties = {
    fontSize: 10,
    fontFamily: '"JetBrains Mono", monospace',
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "var(--ink-60)",
    marginBottom: 6,
    display: "block",
  };
  const fieldS: CSSProperties = { display: "flex", flexDirection: "column" };
  const sectionS: CSSProperties = {
    fontSize: 10,
    fontFamily: '"JetBrains Mono", monospace',
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "var(--ink-60)",
    marginBottom: 16,
  };
  const dividerS: CSSProperties = {
    height: 1,
    background: "var(--ink-06)",
    margin: "22px 0",
  };

  return (
    <ModalOverlay open={open} onClose={onClose} zIndex={1000} overlayColor="rgba(0,0,0,0.45)">
      <style>{`
        @keyframes admin-variant-highlight-pulse {
          0%, 100% { box-shadow: 0 0 0 3px transparent; background-color: transparent; }
          15%, 70% { box-shadow: 0 0 0 3px var(--coral); background-color: color-mix(in oklab, var(--coral) 14%, transparent); }
        }
        .admin-variant-highlight { animation: admin-variant-highlight-pulse 2.6s ease; border-radius: 8px; }
      `}</style>
      <div
        style={{
          background: "var(--cream)",
          borderRadius: 20,
          border: "1px solid var(--ink-06)",
          width: "100%",
          maxWidth: 720,
          maxHeight: "92vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "22px 28px",
            borderBottom: "1px solid var(--ink-06)",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--ink-60)",
                marginBottom: 4,
              }}
            >
              {mode === "add" ? t('admin.productModal.kickerNew') : t('admin.productModal.kickerEdit')}
            </div>
            <h2
              style={{
                fontFamily: '"Instrument Serif", serif',
                fontSize: 28,
                margin: 0,
                fontWeight: 400,
                letterSpacing: "-0.02em",
              }}
            >
              {mode === "add" ? (
                <>
                  {t('admin.productModal.addTitlePrefix')} <em style={{ color: "var(--green)" }}>{t('admin.productModal.addTitleEmphasis')}</em>
                </>
              ) : (
                form.name || t('admin.productModal.editFallbackTitle')
              )}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontFamily: '"JetBrains Mono", monospace',
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: form.active ? "var(--green)" : "var(--ink-40)",
                }}
              >
                {form.active ? t('admin.products.filters.statusActive') : t('admin.products.filters.statusInactive')}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={form.active}
                aria-label={t('admin.productModal.activeToggleAria')}
                onClick={() =>
                  setForm((prev) => ({ ...prev, active: !prev.active }))
                }
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 999,
                  border: "none",
                  padding: 2,
                  cursor: "pointer",
                  background: form.active ? "var(--green)" : "var(--ink-20)",
                  transition: "background 0.15s ease",
                  flexShrink: 0,
                  position: "relative",
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                    transform: form.active
                      ? "translateX(18px)"
                      : "translateX(0)",
                    transition: "transform 0.15s ease",
                  }}
                />
              </button>
            </label>
            <button
              onClick={onClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                border: "1px solid var(--ink-06)",
                background: "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div ref={contentRef} style={{ flex: 1, overflowY: "auto", padding: 28 }}>
          {/* Información básica */}
          <div style={sectionS}>{t('admin.productModal.basicInfo.sectionTitle')}</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div style={fieldS}>
              <label style={labelS}>{t('admin.productModal.basicInfo.nameLabel')} <span style={{ color: "#e53e3e" }}>*</span></label>
              <input
                style={inputS}
                value={form.name}
                onChange={setF("name")}
                placeholder={t('admin.productModal.basicInfo.namePlaceholder')}
              />
            </div>
            <div style={fieldS}>
              <label style={labelS}>{t('admin.productModal.basicInfo.brandLabel')} <span style={{ color: "#e53e3e" }}>*</span></label>
              <input
                style={inputS}
                value={form.brand}
                onChange={setF("brand")}
                placeholder={t('admin.productModal.basicInfo.brandPlaceholder')}
              />
            </div>
            <div style={fieldS}>
              <label style={labelS}>{t('admin.productModal.basicInfo.categoryLabel')} <span style={{ color: "#e53e3e" }}>*</span></label>
              <Select
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    category: e.target.value,
                  }))
                }
              >
                <option value="">{t('admin.products.categoryDiscountModal.categoryPlaceholder')}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {translatedCategoryLabel(t, c)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div style={fieldS}>
            <label style={labelS}>{t('admin.productModal.basicInfo.shortLabel')} <span style={{ color: "#e53e3e" }}>*</span></label>
            <textarea
              style={{
                ...inputS,
                resize: "vertical",
                minHeight: 68,
              }}
              value={form.short}
              onChange={setF("short")}
              placeholder={t('admin.productModal.basicInfo.shortPlaceholder')}
            />
          </div>
          <div style={{ ...fieldS, maxWidth: 220, marginTop: 12 }}>
            <label style={labelS}>{t('admin.productModal.basicInfo.lowStockLabel')}</label>
            <input
              style={inputS}
              type="number"
              value={form.lowStockThreshold}
              onChange={setF("lowStockThreshold")}
              min={0}
              placeholder={t('admin.productModal.basicInfo.lowStockPlaceholder', { count: DEFAULT_LOW_STOCK_THRESHOLD })}
            />
          </div>
          <div style={{ ...fieldS, maxWidth: 280, marginTop: 16 }}>
            <label style={labelS}>{t('admin.productModal.basicInfo.sampleEligibleLabel')}</label>
            <Select value={form.sampleEligible} onChange={setSelect("sampleEligible")}>
              <option value="auto">{t('admin.productModal.basicInfo.sampleAuto')}</option>
              <option value="include">{t('admin.productModal.basicInfo.sampleInclude')}</option>
              <option value="exclude">{t('admin.productModal.basicInfo.sampleExclude')}</option>
            </Select>
          </div>
          <div style={dividerS} />

          {/* Tipo de producto / variantes — decide esto primero, define lo que sigue */}
          <div style={sectionS}>{t('admin.productModal.productType.sectionTitle')}</div>
          <div
            style={{
              fontSize: 12,
              fontFamily: '"Geist", sans-serif',
              color: "var(--ink-60)",
              marginBottom: 16,
              maxWidth: 520,
            }}
          >
            {t('admin.productModal.productType.hint')}
          </div>
          <ProductVariantsMatrixEditor
            mode={form.variantsMode}
            onModeChange={(variantsMode) => setForm((prev) => ({ ...prev, variantsMode }))}
            simple={form.variantsSimple}
            onSimpleChange={(variantsSimple) => setForm((prev) => ({ ...prev, variantsSimple }))}
            matrix={form.variantsMatrix}
            onMatrixChange={(variantsMatrix) => setForm((prev) => ({ ...prev, variantsMatrix }))}
            folder={slugify(form.name) || 'general'}
          />

          {usesGenericFields && (
            <>
              <div style={dividerS} />

              {/* Precio & Inventario */}
              <div style={sectionS}>{t('admin.productModal.pricingInventory.sectionTitle')}</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <div style={fieldS}>
                  <label style={labelS}>{t('admin.productModal.pricingInventory.priceLabel')} <span style={{ color: "#e53e3e" }}>*</span></label>
                  <input
                    style={inputS}
                    type="number"
                    value={form.price}
                    onChange={setF("price")}
                    min={0}
                    step={0.01}
                  />
                </div>
                <div style={fieldS}>
                  <label style={labelS}>{t('admin.productModal.pricingInventory.stockLabel')} <span style={{ color: "#e53e3e" }}>*</span></label>
                  <input
                    style={inputS}
                    type="number"
                    value={form.stock}
                    onChange={setF("stock")}
                    min={0}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <div style={fieldS}>
                  <label style={labelS}>{t('admin.productVariantsEditor.priceBeforeLabel')}</label>
                  <input
                    style={inputS}
                    type="number"
                    value={form.priceBefore}
                    onChange={setF("priceBefore")}
                    min={0}
                    step={0.01}
                    placeholder={t('admin.productVariantsEditor.priceBeforePlaceholder')}
                  />
                </div>
                <div style={fieldS}>
                  <label style={labelS}>{t('admin.productVariantsEditor.validFromLabel')}</label>
                  <DateInputDDMMYYYY
                    style={inputS}
                    value={form.discountStartsAt}
                    onChange={(discountStartsAt) => setForm((prev) => ({ ...prev, discountStartsAt }))}
                    disabled={!form.priceBefore}
                  />
                </div>
                <div style={fieldS}>
                  <label style={labelS}>{t('admin.productVariantsEditor.validUntilLabel')}</label>
                  <DateInputDDMMYYYY
                    style={inputS}
                    value={form.discountEndsAt}
                    onChange={(discountEndsAt) => setForm((prev) => ({ ...prev, discountEndsAt }))}
                    disabled={!form.priceBefore}
                  />
                </div>
              </div>
            </>
          )}

          {usesGenericFields && (
            <>
              <div style={dividerS} />

              {/* Imágenes */}
              <div style={sectionS}>{t('admin.productModal.images.sectionTitle')}</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
              <ImageDropZone
                value={form.imageUrl}
                onChange={setVal("imageUrl")}
                label={t('admin.productModal.images.image1Label')}
                required
                folder={slugify(form.name) || 'general'}
              />
              <ImageDropZone
                value={form.image2}
                onChange={setVal("image2")}
                label={t('admin.productModal.images.image2Label')}
                folder={slugify(form.name) || 'general'}
              />
              <ImageDropZone
                value={form.image3}
                onChange={setVal("image3")}
                label={t('admin.productModal.images.image3Label')}
                folder={slugify(form.name) || 'general'}
              />
              <ImageDropZone
                value={form.image4}
                onChange={setVal("image4")}
                label={t('admin.productModal.images.image4Label')}
                folder={slugify(form.name) || 'general'}
              />
              </div>
            </>
          )}

          <div style={dividerS} />

          {/* Detalles */}
          <div style={sectionS}>{t('admin.productModal.details.sectionTitle')}</div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={fieldS}>
              <label style={labelS}>
                {t('admin.productModal.details.benefitsLabel')}{" "}
                <span
                  style={{
                    fontFamily: '"Geist", sans-serif',
                    textTransform: "none",
                    letterSpacing: 0,
                    fontWeight: 400,
                  }}
                >
                  {t('admin.productModal.details.benefitsHint')}
                </span>
              </label>
              <FormattedTextarea
                style={{
                  ...inputS,
                  resize: "vertical",
                  minHeight: 88,
                }}
                value={form.benefits}
                onChange={setVal("benefits")}
                placeholder={t('admin.productModal.details.benefitsPlaceholder')}
              />
            </div>
            <div style={fieldS}>
              <label style={labelS}>{t('admin.productModal.details.usageLabel')}</label>
              <FormattedTextarea
                style={{
                  ...inputS,
                  resize: "vertical",
                  minHeight: 68,
                }}
                value={form.usage}
                onChange={setVal("usage")}
                placeholder={t('admin.productModal.details.usagePlaceholder')}
              />
            </div>
            <div style={fieldS}>
              <label style={labelS}>{t('admin.productModal.details.ingredientsLabel')}</label>
              <FormattedTextarea
                style={{
                  ...inputS,
                  resize: "vertical",
                  minHeight: 68,
                }}
                value={form.ingredients}
                onChange={setVal("ingredients")}
                placeholder={t('admin.productModal.details.ingredientsPlaceholder')}
              />
            </div>
            <div style={fieldS}>
              <label style={labelS}>{t('admin.productModal.details.warningsLabel')}</label>
              <FormattedTextarea
                style={{
                  ...inputS,
                  resize: "vertical",
                  minHeight: 68,
                }}
                value={form.warnings}
                onChange={setVal("warnings")}
                placeholder={t('admin.productModal.details.warningsPlaceholder')}
              />
            </div>
          </div>

          {/* Extra Tabs */}
          <div
            style={{
              padding: "0 28px 20px",
              borderTop: "1px solid var(--ink-06)",
              marginTop: 8,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--ink-60)",
                marginBottom: 12,
                marginTop: 16,
              }}
            >
              {t('admin.productModal.extraTabs.sectionTitle')}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {form.extraTabs.map((tab, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "var(--cream-2)",
                    border: "1px solid var(--ink-06)",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <label style={labelS}>{t('admin.productModal.extraTabs.titleLabel')} <span style={{ color: "#e53e3e" }}>*</span></label>
                    <input
                      value={tab.label}
                      onChange={(e) => {
                        const newTabs = [...form.extraTabs];
                        newTabs[idx] = {
                          ...newTabs[idx],
                          label: e.target.value,
                        };
                        setForm((prev) => ({ ...prev, extraTabs: newTabs }));
                      }}
                      placeholder={t('admin.productModal.extraTabs.titlePlaceholder')}
                      style={{ ...inputS, fontSize: 12, fontWeight: 500 }}
                    />
                    <label style={labelS}>{t('admin.productModal.extraTabs.contentLabel')} <span style={{ color: "#e53e3e" }}>*</span></label>
                    <FormattedTextarea
                      value={tab.content}
                      onChange={(content) => {
                        const newTabs = [...form.extraTabs];
                        newTabs[idx] = {
                          ...newTabs[idx],
                          content,
                        };
                        setForm((prev) => ({ ...prev, extraTabs: newTabs }));
                      }}
                      placeholder={t('admin.productModal.extraTabs.contentPlaceholder')}
                      style={{
                        ...inputS,
                        minHeight: 60,
                        resize: "vertical",
                        fontSize: 12,
                      }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      const newTabs = form.extraTabs.filter(
                        (_, i) => i !== idx,
                      );
                      setForm((prev) => ({ ...prev, extraTabs: newTabs }));
                    }}
                    style={{ ...iconBtnAd, color: "var(--coral)" }}
                    title={t('admin.productModal.extraTabs.removeTitle')}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    extraTabs: [
                      ...prev.extraTabs,
                      { id: "", label: "", content: "" },
                    ],
                  }))
                }
                style={{
                  fontSize: 12,
                  color: "var(--green)",
                  cursor: "pointer",
                  padding: "8px 0",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                }}
              >
                {t('admin.productModal.extraTabs.addButton')}
              </button>
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "16px 28px",
            borderTop: "1px solid var(--ink-06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "oklch(0.5 0.15 30)",
              fontFamily: '"Geist", sans-serif',
              minHeight: 18,
            }}
          >
            {validationError || error || ""}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <AnimatedButton variant="outline" onClick={onClose} text={t('admin.productModal.cancel')} />
            <AnimatedButton variant="primary" onClick={handleSave} disabled={saving} text={saving ? t('admin.productModal.saving') : mode === "add" ? t('admin.productModal.addProduct') : t('admin.productModal.saveChanges')} />
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}
