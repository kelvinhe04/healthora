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
    opacity: disabled ? 0.5 : 1,
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
      <span>{text}</span>
      {icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
    </button>
  );
}
