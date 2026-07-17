import { useTranslation } from 'react-i18next';

export type ColorPreset = { label: string; value: string };

const labelStyle = { fontSize: 12, color: 'var(--ink-60)' };

export function ColorPicker({
  value,
  onChange,
  presets,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  presets: ColorPreset[];
  label: string;
}) {
  const { t } = useTranslation();
  const isCustom = !presets.some((p) => p.value === value);
  const hexValue = /^#[0-9a-f]{6}$/i.test(value) ? value : '#e4f248';

  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {presets.map((preset) => (
          <button
            key={preset.value}
            type="button"
            title={preset.label}
            onClick={() => onChange(preset.value)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              background: preset.value,
              border: value === preset.value ? '2px solid var(--ink)' : '1px solid var(--ink-12)',
              cursor: 'pointer',
              padding: 0,
            }}
          />
        ))}
        <button
          type="button"
          title={t('admin.shared.colorPicker.custom')}
          onClick={() => onChange(hexValue)}
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
            border: isCustom ? '2px solid var(--ink)' : '1px solid var(--ink-12)',
            cursor: 'pointer',
            padding: 0,
          }}
        />
        {isCustom && (
          <input
            type="color"
            value={hexValue}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: 40, height: 30, padding: 0, border: '1px solid var(--ink-12)', borderRadius: 8, cursor: 'pointer' }}
          />
        )}
      </div>
    </div>
  );
}
