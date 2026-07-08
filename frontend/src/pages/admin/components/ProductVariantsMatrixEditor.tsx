import type { CSSProperties } from 'react';
import { iconBtnAd } from '../../../components/admin';
import { Icon } from '../../../components/shared/Icon';
import { emptyVariantRow, type VariantFormRow } from '../types';
import {
  cellKey,
  emptyMatrixCell,
  emptyPrimaryRow,
  emptySizeRow,
  getVariantTab,
  PRIMARY_TYPE_LABELS,
  type MatrixCell,
  type MatrixPrimaryRow,
  type MatrixSizeRow,
  type MatrixState,
  type PrimaryVariantType,
} from '../variantMatrix';
import { ProductVariantsEditor } from './ProductVariantsEditor';
import { MiniImagePicker } from './MiniImagePicker';

const inputS: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--ink-20)',
  background: 'var(--cream-2)',
  fontSize: 12,
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

const sectionTitleS: CSSProperties = {
  fontSize: 10,
  fontFamily: '"JetBrains Mono", monospace',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--ink-60)',
  marginBottom: 12,
};

const columnLabelS: CSSProperties = {
  fontSize: 10,
  fontFamily: '"JetBrains Mono", monospace',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--ink-40)',
};

function tabS(active: boolean): CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 999,
    border: active ? 'none' : '1px solid var(--ink-20)',
    background: active ? 'var(--ink)' : 'transparent',
    color: active ? 'var(--cream)' : 'var(--ink)',
    fontSize: 12,
    fontFamily: '"Geist", sans-serif',
    fontWeight: 600,
    cursor: 'pointer',
  };
}

export function ProductVariantsMatrixEditor({
  mode,
  onModeChange,
  simple,
  onSimpleChange,
  matrix,
  onMatrixChange,
  folder,
}: {
  mode: 'simple' | 'matrix';
  onModeChange: (mode: 'simple' | 'matrix') => void;
  simple: VariantFormRow[];
  onSimpleChange: (rows: VariantFormRow[]) => void;
  matrix: MatrixState;
  onMatrixChange: (matrix: MatrixState) => void;
  folder: string;
}) {
  const updatePrimary = (key: string, patch: Partial<MatrixPrimaryRow>) => {
    onMatrixChange({
      ...matrix,
      primary: matrix.primary.map((p) => {
        if (p.key !== key) return patch.isDefault ? { ...p, isDefault: false } : p;
        return { ...p, ...patch };
      }),
    });
  };

  const removePrimary = (key: string) => {
    const cells = { ...matrix.cells };
    for (const s of matrix.sizes) delete cells[cellKey(key, s.key)];
    onMatrixChange({ ...matrix, primary: matrix.primary.filter((p) => p.key !== key), cells });
  };

  const updateSize = (key: string, patch: Partial<MatrixSizeRow>) => {
    onMatrixChange({
      ...matrix,
      sizes: matrix.sizes.map((s) => {
        if (s.key !== key) return patch.isDefault ? { ...s, isDefault: false } : s;
        return { ...s, ...patch };
      }),
    });
  };

  const removeSize = (key: string) => {
    const cells = { ...matrix.cells };
    for (const p of matrix.primary) delete cells[cellKey(p.key, key)];
    onMatrixChange({ ...matrix, sizes: matrix.sizes.filter((s) => s.key !== key), cells });
  };

  const toggleCell = (pKey: string, sKey: string) => {
    const key = cellKey(pKey, sKey);
    const cells = { ...matrix.cells };
    if (cells[key]?.active) delete cells[key];
    else cells[key] = emptyMatrixCell();
    onMatrixChange({ ...matrix, cells });
  };

  const updateCell = (pKey: string, sKey: string, patch: Partial<MatrixCell>) => {
    const key = cellKey(pKey, sKey);
    const existing = matrix.cells[key];
    if (!existing?.active) return;
    onMatrixChange({ ...matrix, cells: { ...matrix.cells, [key]: { ...existing, ...patch } } });
  };

  const setDefaultCombo = (pKey: string, sKey: string) => {
    onMatrixChange({
      ...matrix,
      primary: matrix.primary.map((p) => ({ ...p, isDefault: p.key === pKey })),
      sizes: matrix.sizes.map((s) => ({ ...s, isDefault: s.key === sKey })),
    });
  };

  const primaryLabels = PRIMARY_TYPE_LABELS[matrix.primaryType];
  const onlyOneCombo = matrix.primary.length === 1 && matrix.sizes.length === 1;

  const activeTab = getVariantTab(mode, simple.length);

  const tabHint: Record<'none' | 'simple' | 'matrix', string> = {
    none: 'El producto usa un solo precio y stock (los campos de arriba). No hay opciones para elegir.',
    simple: 'Una lista de opciones de un solo tipo (ej. solo tamaño, o solo color) — cada una con su propio precio y stock.',
    matrix: 'Dos dimensiones combinadas (ej. sabor + tamaño): cada combinación puede tener su propio precio, stock e imágenes.',
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          style={tabS(activeTab === 'none')}
          onClick={() => {
            onModeChange('simple');
            if (simple.length > 0) onSimpleChange([]);
          }}
        >
          Sin variante
        </button>
        <button
          type="button"
          style={tabS(activeTab === 'simple')}
          onClick={() => {
            onModeChange('simple');
            if (simple.length === 0) onSimpleChange([emptyVariantRow()]);
          }}
        >
          Variante simple
        </button>
        <button type="button" style={tabS(activeTab === 'matrix')} onClick={() => onModeChange('matrix')}>
          Variante × Tamaño
        </button>
      </div>
      <div style={{ fontSize: 12, fontFamily: '"Geist", sans-serif', color: 'var(--ink-60)', marginBottom: 16, maxWidth: 520 }}>
        {tabHint[activeTab]}
      </div>

      {mode === 'simple' ? (
        activeTab === 'simple' && <ProductVariantsEditor variants={simple} onChange={onSimpleChange} folder={folder} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={labelS}>Tipo de variante</label>
            <select
              style={{ ...inputS, width: 160, cursor: 'pointer' }}
              value={matrix.primaryType}
              onChange={(e) => onMatrixChange({ ...matrix, primaryType: e.target.value as PrimaryVariantType })}
            >
              <option value="flavor">Sabor</option>
              <option value="scent">Aroma</option>
              <option value="color">Color</option>
              <option value="weight">Peso</option>
              <option value="count">Conteo</option>
            </select>
          </div>

          <div>
            <div style={sectionTitleS}>{primaryLabels.plural}</div>
            <div style={{ fontSize: 11, fontFamily: '"Geist", sans-serif', color: 'var(--ink-40)', marginBottom: 8, maxWidth: 520 }}>
              Solo el nombre — el precio, stock e imágenes de cada combinación se ajustan más abajo, en "Combinaciones".
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: matrix.primaryType === 'color' ? '1fr auto auto' : '1fr auto',
                gap: 8,
                padding: '0 10px',
                marginBottom: 4,
              }}
            >
              <span style={columnLabelS}>Nombre</span>
              {matrix.primaryType === 'color' && <span style={columnLabelS}>Color</span>}
              <span />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {matrix.primary.map((p) => (
                <div
                  key={p.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: matrix.primaryType === 'color' ? '1fr auto auto' : '1fr auto',
                    gap: 8,
                    alignItems: 'center',
                    padding: 10,
                    borderRadius: 10,
                    background: 'var(--cream-2)',
                    border: '1px solid var(--ink-06)',
                  }}
                >
                  <input
                    style={inputS}
                    placeholder={`ej. ${primaryLabels.singular === 'Color' ? 'Rojo' : 'Chocolate'}`}
                    value={p.label}
                    onChange={(e) => updatePrimary(p.key, { label: e.target.value })}
                  />
                  {matrix.primaryType === 'color' && (
                    <input
                      style={{ ...inputS, padding: '6px 8px', width: 44 }}
                      type="color"
                      title="Color (hex)"
                      value={/^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : '#cccccc'}
                      onChange={(e) => updatePrimary(p.key, { color: e.target.value })}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removePrimary(p.key)}
                    style={{ ...iconBtnAd, color: 'var(--coral)' }}
                    title={`Eliminar ${primaryLabels.singular.toLowerCase()}`}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onMatrixChange({ ...matrix, primary: [...matrix.primary, emptyPrimaryRow()] })}
              style={{ fontSize: 12, color: 'var(--green)', cursor: 'pointer', padding: '10px 0 0', textAlign: 'left', background: 'transparent', border: 'none' }}
            >
              + Agregar {primaryLabels.singular.toLowerCase()}
            </button>
          </div>

          <div>
            <div style={sectionTitleS}>Tamaños</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.3fr 0.7fr 0.6fr auto',
                gap: 8,
                padding: '0 10px',
                marginBottom: 4,
              }}
            >
              <span style={columnLabelS}>Nombre</span>
              <span style={columnLabelS}>Precio base <span style={{ color: '#e53e3e' }}>*</span></span>
              <span style={columnLabelS}>Stock <span style={{ color: '#e53e3e' }}>*</span></span>
              <span />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {matrix.sizes.map((s) => (
                <div
                  key={s.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.3fr 0.7fr 0.6fr auto',
                    gap: 8,
                    alignItems: 'center',
                    padding: 10,
                    borderRadius: 10,
                    background: 'var(--cream-2)',
                    border: '1px solid var(--ink-06)',
                  }}
                >
                  <input
                    style={inputS}
                    placeholder="ej. 5 lb"
                    value={s.label}
                    onChange={(e) => updateSize(s.key, { label: e.target.value })}
                  />
                  <input
                    style={inputS}
                    type="number"
                    placeholder="Precio"
                    value={s.price}
                    onChange={(e) => updateSize(s.key, { price: e.target.value })}
                  />
                  <input
                    style={inputS}
                    type="number"
                    placeholder="Stock"
                    value={s.stock}
                    onChange={(e) => updateSize(s.key, { stock: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeSize(s.key)}
                    style={{ ...iconBtnAd, color: 'var(--coral)' }}
                    title="Eliminar tamaño"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onMatrixChange({ ...matrix, sizes: [...matrix.sizes, emptySizeRow()] })}
              style={{ fontSize: 12, color: 'var(--green)', cursor: 'pointer', padding: '10px 0 0', textAlign: 'left', background: 'transparent', border: 'none' }}
            >
              + Agregar tamaño
            </button>
          </div>

          {matrix.primary.length > 0 && matrix.sizes.length > 0 && (
            <div>
              <div style={sectionTitleS}>Combinaciones</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 120 }} />
                    {matrix.sizes.map((s) => (
                      <col key={s.key} style={{ width: 220 }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: 8, fontSize: 11, color: 'var(--ink-60)' }}>{primaryLabels.singular} \ Tamaño</th>
                      {matrix.sizes.map((s) => (
                        <th key={s.key} style={{ padding: 8, fontSize: 11, color: 'var(--ink-60)' }}>
                          {s.label || '(sin nombre)'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.primary.map((p) => (
                      <tr key={p.key}>
                        <td style={{ padding: 8, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{p.label || '(sin nombre)'}</td>
                        {matrix.sizes.map((s) => {
                          const cell = matrix.cells[cellKey(p.key, s.key)];
                          const active = Boolean(cell?.active);
                          const isDefaultCombo = p.isDefault && s.isDefault;
                          const imagesInherited = !cell?.imagesTouched && p.images.length > 0;
                          const effectiveImages = cell?.imagesTouched ? cell.images : p.images;
                          return (
                            <td key={s.key} style={{ padding: 8, verticalAlign: 'top', border: '1px solid var(--ink-06)' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: active ? 8 : 0 }}>
                                <input
                                  type="checkbox"
                                  checked={active}
                                  onChange={() => toggleCell(p.key, s.key)}
                                  style={{ width: 15, height: 15, accentColor: 'var(--green)', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: 11, color: 'var(--ink-60)' }}>Activo</span>
                              </label>
                              {active && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <input
                                    style={{ ...inputS, fontSize: 11 }}
                                    type="number"
                                    placeholder={`Precio (default: $${((parseFloat(p.price) || 0) + (parseFloat(s.price) || 0)).toFixed(2)})`}
                                    title="Solo si esta combinación necesita un precio distinto al default"
                                    value={cell?.price ?? ''}
                                    onChange={(e) => updateCell(p.key, s.key, { price: e.target.value })}
                                  />
                                  <input
                                    style={{ ...inputS, fontSize: 11 }}
                                    type="number"
                                    placeholder={`Stock (default: ${s.stock})`}
                                    value={cell?.stock ?? ''}
                                    onChange={(e) => updateCell(p.key, s.key, { stock: e.target.value })}
                                  />
                                  <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-40)' }}>
                                    Imágenes {effectiveImages.length === 0 && <span style={{ color: '#e53e3e' }}>*</span>}
                                  </span>
                                  {imagesInherited && (
                                    <div style={{ fontSize: 10, color: 'var(--ink-40)', fontFamily: '"Geist", sans-serif' }}>
                                      Parten de "{p.label.trim() || primaryLabels.singular}" — agrega o quita libremente, solo afecta esta combinación.
                                    </div>
                                  )}
                                  <MiniImagePicker
                                    images={effectiveImages}
                                    onChange={(images) => updateCell(p.key, s.key, { images, imagesTouched: true })}
                                    folder={folder}
                                  />
                                  {isDefaultCombo && (
                                    <div style={{ fontSize: 10, color: 'var(--ink-40)', fontFamily: '"Geist", sans-serif' }}>
                                      {effectiveImages.length > 1
                                        ? 'La 2ª imagen se usa para el efecto hover de la card en el catálogo.'
                                        : 'Si agregas una 2ª imagen aquí, se usará para el efecto hover de la card en el catálogo.'}
                                    </div>
                                  )}
                                  {!onlyOneCombo && (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} title="Combo predeterminado">
                                      <input
                                        type="radio"
                                        name="default-combo"
                                        checked={isDefaultCombo}
                                        onChange={() => setDefaultCombo(p.key, s.key)}
                                        style={{ width: 14, height: 14, accentColor: 'var(--green)', cursor: 'pointer' }}
                                      />
                                      <span style={{ fontSize: 10, color: 'var(--ink-60)' }}>Default</span>
                                    </label>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
