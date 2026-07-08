import { type ChangeEvent, useEffect, useState, type CSSProperties } from 'react';
import type { Product } from '../../../types';
import { iconBtnAd } from '../../../components/admin';
import { AnimatedButton } from '../../../components/shared/AnimatedButton';
import { Icon } from '../../../components/shared/Icon';
import { ModalOverlay } from '../../../components/shared/ModalOverlay';
import { emptyForm, type ProductForm } from '../types';
import { formToPayload, productToForm } from '../utils';
import { FormattedTextarea } from './FormattedTextarea';
import { ImageDropZone } from './ImageDropZone';
import { ProductVariantsMatrixEditor } from './ProductVariantsMatrixEditor';
import { slugify } from '../utils';
import { cellKey, getVariantTab } from '../variantMatrix';

export function ProductModal({
  open,
  mode,
  product,
  categories,
  onClose,
  onSave,
  saving,
  error,
}: {
  open: boolean;
  mode: "add" | "edit";
  product?: Product;
  categories: string[];
  onClose: () => void;
  onSave: (data: Partial<Product>) => void;
  saving: boolean;
  error?: string | null;
}) {
  const [form, setForm] = useState<ProductForm>(() =>
    product ? productToForm(product) : { ...emptyForm },
  );
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(product ? productToForm(product) : { ...emptyForm });
      setValidationError("");
    }
  }, [open]);

  const setF =
    (key: keyof ProductForm) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const _setSelect =
    (key: keyof ProductForm) => (e: ChangeEvent<HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setVal = (key: keyof ProductForm) => (v: string) =>
    setForm((prev) => ({ ...prev, [key]: v }));

  const variantTab = getVariantTab(form.variantsMode, form.variantsSimple.length);
  const usesGenericFields = variantTab === "none";

  const handleSave = () => {
    if (!form.name.trim()) {
      setValidationError("El nombre es obligatorio.");
      return;
    }
    if (!form.brand.trim()) {
      setValidationError("La marca es obligatoria.");
      return;
    }
    if (!form.category.trim()) {
      setValidationError("La categoría es obligatoria.");
      return;
    }
    if (!form.short.trim()) {
      setValidationError("La descripción corta es obligatoria.");
      return;
    }
    if (usesGenericFields && (parseFloat(form.price) || 0) <= 0) {
      setValidationError("El precio debe ser mayor a 0.");
      return;
    }
    if (usesGenericFields && (parseInt(form.stock) || 0) <= 0) {
      setValidationError("Las existencias tienen que ser mayor a 0.");
      return;
    }
    if (variantTab === "simple") {
      for (const row of form.variantsSimple) {
        if (!row.label.trim()) {
          setValidationError("Cada variante necesita una etiqueta.");
          return;
        }
        if ((parseFloat(row.price) || 0) <= 0) {
          setValidationError(`"${row.label.trim()}" necesita un precio mayor a 0.`);
          return;
        }
        if ((parseInt(row.stock, 10) || 0) <= 0) {
          setValidationError(`"${row.label.trim()}" necesita stock mayor a 0.`);
          return;
        }
        if (row.images.length === 0) {
          setValidationError(`"${row.label.trim()}" necesita al menos 1 imagen.`);
          return;
        }
      }
    } else if (variantTab === "matrix") {
      if (form.variantsMatrix.primary.length === 0) {
        setValidationError("Agrega al menos un sabor/variante.");
        return;
      }
      if (form.variantsMatrix.sizes.length === 0) {
        setValidationError("Agrega al menos un tamaño.");
        return;
      }
      for (const row of form.variantsMatrix.primary) {
        if (!row.label.trim()) {
          setValidationError("Cada sabor necesita una etiqueta.");
          return;
        }
      }
      for (const row of form.variantsMatrix.sizes) {
        if (!row.label.trim()) {
          setValidationError("Cada tamaño necesita una etiqueta.");
          return;
        }
        if ((parseFloat(row.price) || 0) <= 0) {
          setValidationError(`"${row.label.trim()}" necesita un precio base mayor a 0.`);
          return;
        }
        if ((parseInt(row.stock, 10) || 0) <= 0) {
          setValidationError(`"${row.label.trim()}" necesita un stock base mayor a 0.`);
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
              `"${p.label.trim()} × ${s.label.trim()}" necesita al menos 1 imagen (o agrega imágenes a "${p.label.trim()}" para que apliquen a todos sus tamaños).`,
            );
            return;
          }
        }
      }
    }
    if (usesGenericFields && !form.imageUrl.trim()) {
      setValidationError("La imagen 1 es obligatoria.");
      return;
    }
    for (const tab of form.extraTabs) {
      if (Boolean(tab.label.trim()) !== Boolean(tab.content.trim())) {
        setValidationError("Cada pestaña personalizada necesita título y contenido (o elimínala).");
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
              {mode === "add" ? "Nuevo producto" : "Editar producto"}
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
                  Agregar <em style={{ color: "var(--green)" }}>producto</em>
                </>
              ) : (
                form.name || "Editar"
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
                {form.active ? "Activo" : "Inactivo"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={form.active}
                aria-label="Producto activo (visible en la tienda)"
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
        <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>
          {/* Información básica */}
          <div style={sectionS}>Información básica</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div style={fieldS}>
              <label style={labelS}>Nombre <span style={{ color: "#e53e3e" }}>*</span></label>
              <input
                style={inputS}
                value={form.name}
                onChange={setF("name")}
                placeholder="Nombre del producto"
              />
            </div>
            <div style={fieldS}>
              <label style={labelS}>Marca <span style={{ color: "#e53e3e" }}>*</span></label>
              <input
                style={inputS}
                value={form.brand}
                onChange={setF("brand")}
                placeholder="Nombre de la marca"
              />
            </div>
            <div style={fieldS}>
              <label style={labelS}>Categoría <span style={{ color: "#e53e3e" }}>*</span></label>
              <select
                style={{
                  ...inputS,
                  appearance: "none",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  paddingRight: 32,
                  cursor: "pointer",
                }}
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    category: e.target.value,
                  }))
                }
              >
                <option value="">Seleccionar categoría…</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={fieldS}>
            <label style={labelS}>Descripción corta <span style={{ color: "#e53e3e" }}>*</span></label>
            <textarea
              style={{
                ...inputS,
                resize: "vertical",
                minHeight: 68,
              }}
              value={form.short}
              onChange={setF("short")}
              placeholder="Breve descripción del producto…"
            />
          </div>
          <div style={dividerS} />

          {/* Tipo de producto / variantes — decide esto primero, define lo que sigue */}
          <div style={sectionS}>Tipo de producto</div>
          <div
            style={{
              fontSize: 12,
              fontFamily: '"Geist", sans-serif',
              color: "var(--ink-60)",
              marginBottom: 16,
              maxWidth: 520,
            }}
          >
            ¿El producto tiene un solo precio/stock, o varía por opción (ej. sabor, tamaño, color)? Esto define qué campos ves más abajo.
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
              <div style={sectionS}>Precio · Inventario</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <div style={fieldS}>
                  <label style={labelS}>Precio ($) <span style={{ color: "#e53e3e" }}>*</span></label>
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
                  <label style={labelS}>Existencias <span style={{ color: "#e53e3e" }}>*</span></label>
                  <input
                    style={inputS}
                    type="number"
                    value={form.stock}
                    onChange={setF("stock")}
                    min={0}
                  />
                </div>
              </div>
            </>
          )}

          {usesGenericFields && (
            <>
              <div style={dividerS} />

              {/* Imágenes */}
              <div style={sectionS}>Imágenes del producto</div>
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
                label="Imagen 1 · principal"
                required
                folder={slugify(form.name) || 'general'}
              />
              <ImageDropZone
                value={form.image2}
                onChange={setVal("image2")}
                label="Imagen 2 (opcional)"
                folder={slugify(form.name) || 'general'}
              />
              <ImageDropZone
                value={form.image3}
                onChange={setVal("image3")}
                label="Imagen 3 (opcional)"
                folder={slugify(form.name) || 'general'}
              />
              <ImageDropZone
                value={form.image4}
                onChange={setVal("image4")}
                label="Imagen 4 (opcional)"
                folder={slugify(form.name) || 'general'}
              />
              </div>
            </>
          )}

          <div style={dividerS} />

          {/* Detalles */}
          <div style={sectionS}>Detalles del producto (opcional)</div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={fieldS}>
              <label style={labelS}>
                Beneficios (opcional){" "}
                <span
                  style={{
                    fontFamily: '"Geist", sans-serif',
                    textTransform: "none",
                    letterSpacing: 0,
                    fontWeight: 400,
                  }}
                >
                  (uno por línea)
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
                placeholder={
                  "Opcional: mejora el sistema inmune\nAumenta la energía\nReduce el estrés"
                }
              />
            </div>
            <div style={fieldS}>
              <label style={labelS}>Modo de uso (opcional)</label>
              <FormattedTextarea
                style={{
                  ...inputS,
                  resize: "vertical",
                  minHeight: 68,
                }}
                value={form.usage}
                onChange={setVal("usage")}
                placeholder="Opcional: tomar 1 cápsula al día con agua…"
              />
            </div>
            <div style={fieldS}>
              <label style={labelS}>Ingredientes (opcional)</label>
              <FormattedTextarea
                style={{
                  ...inputS,
                  resize: "vertical",
                  minHeight: 68,
                }}
                value={form.ingredients}
                onChange={setVal("ingredients")}
                placeholder="Opcional: vitamina C 500mg, Zinc 10mg…"
              />
            </div>
            <div style={fieldS}>
              <label style={labelS}>Advertencias (opcional)</label>
              <FormattedTextarea
                style={{
                  ...inputS,
                  resize: "vertical",
                  minHeight: 68,
                }}
                value={form.warnings}
                onChange={setVal("warnings")}
                placeholder="Opcional: mantener fuera del alcance de los niños…"
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
              Pestañas personalizadas
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
                    <label style={labelS}>Título <span style={{ color: "#e53e3e" }}>*</span></label>
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
                      placeholder="ej: Fórmula"
                      style={{ ...inputS, fontSize: 12, fontWeight: 500 }}
                    />
                    <label style={labelS}>Contenido <span style={{ color: "#e53e3e" }}>*</span></label>
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
                      placeholder="Contenido de la pestaña…"
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
                    title="Eliminar pestaña"
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
                + Agregar pestaña
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
            <AnimatedButton variant="outline" onClick={onClose} text="Cancelar" />
            <AnimatedButton variant="primary" onClick={handleSave} disabled={saving} text={saving ? "Guardando…" : mode === "add" ? "Agregar producto" : "Guardar cambios"} />
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}
