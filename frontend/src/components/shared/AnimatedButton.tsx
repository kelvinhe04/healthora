import { useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

type Variant = 'primary' | 'lime' | 'green' | 'outline' | 'ghost' | 'cream' | 'secondary' | 'dark';
type Size = 'sm' | 'md' | 'lg';

interface AnimatedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  text: string;
  variant?: Variant;
  size?: Size;
  full?: boolean;
  icon?: ReactNode;
  /** Shows a spinner in place of `icon` and keeps the button at full opacity (instead of the
   * usual disabled dimming) so a long-running action reads as "working", not "stuck/dead". */
  loading?: boolean;
}

const variantBase: Record<Variant, CSSProperties> = {
  primary:   { background: 'var(--ink)',         color: 'var(--cream)' },
  lime:      { background: 'var(--lime)',         color: 'var(--ink)' },
  green:     { background: 'var(--green)',        color: 'var(--cream)' },
  outline:   { background: 'transparent',         color: 'var(--ink)',  border: '1px solid var(--ink-20)' },
  ghost:     { background: 'transparent',         color: 'var(--ink)' },
  cream:     { background: 'var(--cream)',        color: 'var(--ink)' },
  secondary: { background: 'var(--cream)',        color: 'var(--ink)',  border: '1px solid var(--ink-20)' },
  dark:      { background: 'var(--green)',        color: 'var(--cream)' },
};

const variantHover: Record<Variant, CSSProperties> = {
  primary:   { background: 'var(--ink-80)' },
  lime:      { filter: 'brightness(1.08)' },
  green:     { filter: 'brightness(1.12)' },
  outline:   { background: 'var(--ink-06)' },
  ghost:     { background: 'var(--ink-06)' },
  cream:     { background: 'var(--ink-06)' },
  secondary: { background: 'var(--ink-06)' },
  dark:      { filter: 'brightness(1.12)' },
};

const sizeStyles: Record<Size, CSSProperties> = {
  sm: { padding: '8px 16px',  fontSize: 13 },
  md: { padding: '12px 24px', fontSize: 14 },
  lg: { padding: '16px 32px', fontSize: 15 },
};

export function AnimatedButton({
  text,
  variant = 'primary',
  size = 'md',
  full,
  icon,
  loading,
  style,
  disabled,
  ...props
}: AnimatedButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const base: CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    fontFamily: '"Geist", sans-serif',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled && !loading ? 0.5 : 1,
    outline: 'none',
    whiteSpace: 'nowrap',
    width: full ? '100%' : 'auto',
    transition: 'background 180ms ease, filter 180ms ease, transform 120ms ease',
    transform: disabled ? 'translateY(0) scale(1)' : pressed ? 'scale(0.96)' : hovered ? 'translateY(-1px)' : 'translateY(0) scale(1)',
    ...sizeStyles[size],
    ...variantBase[variant],
    ...(hovered && !disabled ? variantHover[variant] : {}),
    ...style,
  };

  return (
    <button
      type={props.type ?? 'button'}
      {...props}
      disabled={disabled}
      style={base}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      {loading && (
        <span
          aria-hidden="true"
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            animation: 'button-spin 0.7s linear infinite',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
      )}
      <span>{text}</span>
      {icon && !loading && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
    </button>
  );
}
