import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { DateInputDDMMYYYY, iconBtnAd } from '../../../components/admin';
import { Icon } from '../../../components/shared/Icon';
import { Select } from '../../../components/shared/Select';
import { emptyVariantRow, VARIANT_TYPE_OPTIONS, type VariantFormRow } from '../types';
import { MiniImagePicker } from './MiniImagePicker';

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
  folder = 'general',
}: {
  variants: VariantFormRow[];
  onChange: (variants: VariantFormRow[]) => void;
  folder?: string;
}) {
  const { t } = useTranslation();
  const type = variants[0]?.type ?? 'flavor';

  const setType = (nextType: VariantFormRow['type']) =>
    onChange(variants.map((row) => ({ ...row, type: nextType })));

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <label style={labelS}>{t('admin.productVariantsEditor.typeLabel')}</label>
        <Select
          wrapperStyle={{ width: 160 }}
          value={type}
          onChange={(e) => setType(e.target.value as VariantFormRow['type'])}
        >
          {VARIANT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(`admin.variantTypes.${opt.labelKey}`)}
            </option>
          ))}
        </Select>
      </div>
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
        {t('admin.productVariantsEditor.productVariantsLabel')}
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
          {t('admin.productVariantsEditor.noVariants')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {variants.map((row, idx) => (
            <div
              key={idx}
              data-variant-anchor={row.id}
              style={{
                padding: '12px',
                borderRadius: 10,
                background: 'var(--cream-2)',
                border: '1px solid var(--ink-06)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: row.type === 'color' ? '1.3fr 0.7fr 0.7fr 0.8fr auto' : '1.4fr 0.8fr 0.8fr auto',
                  gap: 8,
                  alignItems: 'end',
                }}
              >
              <div>
                <label style={labelS}>{t('admin.productVariantsEditor.rowLabelField')}</label>
                <input
                  style={inputS}
                  value={row.label}
                  onChange={(e) => updateRow(idx, { label: e.target.value })}
                  placeholder={t(`admin.productVariantsEditor.labelPlaceholders.${row.type}`)}
                />
              </div>
              <div>
                <label style={labelS}>{t('admin.productVariantsEditor.priceLabel')} <span style={{ color: '#e53e3e' }}>*</span></label>
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
                <label style={labelS}>{t('admin.productVariantsEditor.stockLabel')} <span style={{ color: '#e53e3e' }}>*</span></label>
                <input
                  style={inputS}
                  type="number"
                  min={0}
                  value={row.stock}
                  onChange={(e) => updateRow(idx, { stock: e.target.value })}
                />
              </div>
              {row.type === 'color' && (
                <div>
                  <label style={labelS}>{t('admin.productVariantsEditor.colorHexLabel')}</label>
                  <input
                    style={{ ...inputS, padding: '6px 8px' }}
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(row.color) ? row.color : '#cccccc'}
                    onChange={(e) => updateRow(idx, { color: e.target.value })}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => removeRow(idx)}
                style={{ ...iconBtnAd, color: 'var(--coral)', marginBottom: 6 }}
                title={t('admin.productVariantsEditor.removeVariantTitle')}
              >
                <Icon name="trash" size={14} />
              </button>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 8,
                }}
              >
                <div>
                  <label style={labelS}>{t('admin.productVariantsEditor.priceBeforeLabel')}</label>
                  <input
                    style={inputS}
                    type="number"
                    min={0}
                    step={0.01}
                    value={row.priceBefore}
                    onChange={(e) => updateRow(idx, { priceBefore: e.target.value })}
                    placeholder={t('admin.productVariantsEditor.priceBeforePlaceholder')}
                  />
                </div>
                <div>
                  <label style={labelS}>{t('admin.productVariantsEditor.validFromLabel')}</label>
                  <DateInputDDMMYYYY
                    style={inputS}
                    value={row.discountStartsAt}
                    onChange={(discountStartsAt) => updateRow(idx, { discountStartsAt })}
                    disabled={!row.priceBefore}
                  />
                </div>
                <div>
                  <label style={labelS}>{t('admin.productVariantsEditor.validUntilLabel')}</label>
                  <DateInputDDMMYYYY
                    style={inputS}
                    value={row.discountEndsAt}
                    onChange={(discountEndsAt) => updateRow(idx, { discountEndsAt })}
                    disabled={!row.priceBefore}
                  />
                </div>
              </div>
              <div>
                <label style={labelS}>{t('admin.productVariantsEditor.imagesLabel')} <span style={{ color: '#e53e3e' }}>*</span></label>
                <MiniImagePicker
                  images={row.images}
                  onChange={(images) => updateRow(idx, { images })}
                  folder={folder}
                />
                {row.isDefault && (
                  <div style={{ fontSize: 10, color: 'var(--ink-40)', fontFamily: '"Geist", sans-serif', marginTop: 4 }}>
                    {row.images.length > 1
                      ? t('admin.productVariantsEditor.hoverHintMultiple')
                      : t('admin.productVariantsEditor.hoverHintSingle')}
                  </div>
                )}
              </div>
              <label
                style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', width: 'fit-content' }}
                title={t('admin.productVariantsEditor.defaultRadioTitle')}
              >
                <input
                  type="radio"
                  name="default-variant"
                  checked={row.isDefault}
                  onChange={() => updateRow(idx, { isDefault: true })}
                  style={{ width: 14, height: 14, accentColor: 'var(--green)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>
                  {t('admin.productVariantsEditor.defaultRadioLabel')}
                </span>
              </label>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => onChange([...variants, { ...emptyVariantRow(), type }])}
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
        {t('admin.productVariantsEditor.addVariantButton')}
      </button>
    </div>
  );
}
