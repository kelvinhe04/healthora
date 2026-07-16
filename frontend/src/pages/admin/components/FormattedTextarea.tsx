import { useRef, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

/** Wraps a plain <textarea> with a bold-insert button so admins don't have to remember the
 * `**texto**` syntax by hand - selects/wraps at the cursor, same trick as markdown editors. */
export function FormattedTextarea({
  value,
  onChange,
  placeholder,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: CSSProperties;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLTextAreaElement>(null);

  const insertBold = () => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    const selected = value.slice(selectionStart, selectionEnd) || t('admin.formattedTextarea.defaultBoldText');
    const next = value.slice(0, selectionStart) + `**${selected}**` + value.slice(selectionEnd);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selectionStart + 2, selectionStart + 2 + selected.length);
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <button
          type="button"
          onClick={insertBold}
          title={t('admin.formattedTextarea.boldTitle')}
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            border: '1px solid var(--ink-20)',
            background: 'var(--cream-2)',
            color: 'var(--ink)',
            fontWeight: 700,
            fontSize: 12,
            fontFamily: '"Geist", sans-serif',
            cursor: 'pointer',
          }}
        >
          B
        </button>
      </div>
      <textarea
        ref={ref}
        style={style}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <div style={{ fontSize: 10, color: 'var(--ink-40)', marginTop: 4, fontFamily: '"Geist", sans-serif' }}>
        {t('admin.formattedTextarea.helpPrefix')} <strong>B</strong> {t('admin.formattedTextarea.helpSuffix')}
      </div>
    </div>
  );
}
