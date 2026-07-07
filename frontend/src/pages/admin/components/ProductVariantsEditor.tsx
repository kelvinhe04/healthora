import type { CSSProperties } from 'react';
import { iconBtnAd } from '../../../components/admin';
import { Icon } from '../../../components/shared/Icon';
import { emptyVariantRow, VARIANT_TYPE_OPTIONS, type VariantFormRow } from '../types';

const inputS: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--ink-20)',
  background: 'var(--cream-2)',
  fontSize: 13,
  fontFamily: '"Geist", sans-serif',
  color: 'var(--ink)',
  boxSizing: 'border-box',
  outline: 'none',
};

const labelS: CSSProperties = {
  fontSize: 10,
  fontFamily: '"JetBrains Mono", monospace',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--ink-60)',
  marginBottom: 6,
  display: 'block',
};

export function ProductVariantsEditor({
  variants,
  onChange,
}: {
  variants: VariantFormRow[];
  onChange: (variants: VariantFormRow[]) => void;
}) {
  const updateRow = (idx: number, patch: Partial<VariantFormRow>) => {
    const next = variants.map((row, i) => {
      if (i !== idx) {
        if (patch.isDefault) return { ...row, isDefault: false };
        return row;
      }
      return { ...row, ...patch };
    });
    onChange(next);
  };

  const removeRow = (idx: number) => onChange(variants.filter((_, i) => i !== idx));

  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontFamily: '"JetBrains Mono", monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--ink-60)',
          marginBottom: 12,
        }}
      >
        Variantes del producto
      </div>
      {variants.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: 'var(--ink-60)',
            fontFamily: '"Geist", sans-serif',
            padding: '12px 0',
          }}
        >
          Sin variantes — el producto usa precio y stock global.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {variants.map((row, idx) => (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 0.9fr 0.7fr 0.7fr 0.9fr auto auto',
                gap: 8,
                alignItems: 'end',
                padding: '12px',
                borderRadius: 10,
                background: 'var(--cream-2)',
                border: '1px solid var(--ink-06)',
              }}
            >
              <div>
                <label style={labelS}>Etiqueta</label>
                <input
                  style={inputS}
                  value={row.label}
                  onChange={(e) => updateRow(idx, { label: e.target.value })}
                  placeholder="ej. 60 tabletas"
                />
              </div>
              <div>
                <label style={labelS}>Tipo</label>
                <select
                  style={{ ...inputS, cursor: 'pointer' }}
                  value={row.type}
                  onChange={(e) =>
                    updateRow(idx, { type: e.target.value as VariantFormRow['type'] })
                  }
                >
                  {VARIANT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelS}>Precio ($)</label>
                <input
                  style={inputS}
                  type="number"
                  min={0}
                  step={0.01}
                  value={row.price}
                  onChange={(e) => updateRow(idx, { price: e.target.value })}
                />
              </div>
              <div>
                <label style={labelS}>Stock</label>
                <input
                  style={inputS}
                  type="number"
                  min={0}
                  value={row.stock}
                  onChange={(e) => updateRow(idx, { stock: e.target.value })}
                />
              </div>
              <div>
                <label style={labelS}>SKU</label>
                <input
                  style={inputS}
                  value={row.sku}
                  onChange={(e) => updateRow(idx, { sku: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  paddingBottom: 10,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontSize: 12,
                  fontFamily: '"Geist", sans-serif',
                }}
                title="Variante predeterminada"
              >
                <input
                  type="checkbox"
                  checked={row.isDefault}
                  onChange={(e) => updateRow(idx, { isDefault: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: 'var(--green)', cursor: 'pointer' }}
                />
                Default
              </label>
              <button
                type="button"
                onClick={() => removeRow(idx)}
                style={{ ...iconBtnAd, color: 'var(--coral)', marginBottom: 6 }}
                title="Eliminar variante"
              >
                <Icon name="trash-2" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => onChange([...variants, emptyVariantRow()])}
        style={{
          fontSize: 12,
          color: 'var(--green)',
          cursor: 'pointer',
          padding: '12px 0 0',
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
        }}
      >
        + Agregar variante
      </button>
    </div>
  );
}
