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

  const base: CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
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
    transition: 'background 180ms ease, filter 180ms ease, transform 180ms ease',
    transform: hovered && !disabled ? 'translateY(-1px)' : 'translateY(0)',
    ...sizeStyles[size],
    ...variantBase[variant],
    ...(hovered && !disabled ? variantHover[variant] : {}),
    ...style,
  };

  return (
    <button
      {...props}
      disabled={disabled}
      style={base}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* animated letters */}
      <span style={{ display: 'inline-flex' }}>
        {text.split('').map((char, index) => (
          <span
            key={index}
            style={{ position: 'relative', display: 'inline-block', overflow: 'hidden', whiteSpace: 'pre' }}
          >
            <span
              style={{
                display: 'inline-block',
                transform: hovered && !disabled ? 'translateY(-100%)' : 'translateY(0)',
                transition: 'transform 150ms ease-in-out',
                transitionDelay: `${index * 0.018}s`,
              }}
            >
              {char === ' ' ? ' ' : char}
            </span>
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                display: 'inline-block',
                transform: hovered && !disabled ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 150ms ease-in-out',
                transitionDelay: `${index * 0.018}s`,
              }}
            >
              {char === ' ' ? ' ' : char}
            </span>
          </span>
        ))}
      </span>
      {/* animated icon — slides with the text, delay after last character */}
      {icon && (
        <span style={{ position: 'relative', display: 'inline-flex', overflow: 'hidden', flexShrink: 0 }}>
          <span
            style={{
              display: 'inline-flex',
              transform: hovered && !disabled ? 'translateY(-100%)' : 'translateY(0)',
              transition: 'transform 150ms ease-in-out',
              transitionDelay: `${(text.length - 1) * 0.018 + 0.15}s`,
            }}
          >
            {icon}
          </span>
          <span
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              display: 'inline-flex',
              transform: hovered && !disabled ? 'translateY(0)' : 'translateY(100%)',
              transition: 'transform 150ms ease-in-out',
              transitionDelay: `${(text.length - 1) * 0.018 + 0.15}s`,
            }}
          >
            {icon}
          </span>
        </span>
      )}
    </button>
  );
}
