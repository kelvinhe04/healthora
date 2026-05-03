import type { CSSProperties, ReactNode } from 'react';

type Variant = 'primary' | 'lime' | 'green' | 'outline' | 'ghost' | 'cream';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: ReactNode;
  variant?: Variant;
  onClick?: () => void;
  size?: Size;
  style?: CSSProperties;
  full?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}

const variants: Record<Variant, CSSProperties> = {
  primary: { background: 'var(--ink)', color: 'var(--cream)' },
  lime: { background: 'var(--lime)', color: 'var(--ink)' },
  green: { background: 'var(--green)', color: 'var(--cream)' },
  outline: { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--ink-20)' },
  ghost: { background: 'transparent', color: 'var(--ink)' },
  cream: { background: 'var(--cream)', color: 'var(--ink)' },
};

const sizes: Record<Size, CSSProperties> = {
  sm: { padding: '8px 16px', fontSize: 13 },
  md: { padding: '12px 22px', fontSize: 14 },
  lg: { padding: '16px 32px', fontSize: 15 },
};

export function Button({ children, variant = 'primary', onClick, size = 'md', style = {}, full, icon, disabled, type = 'button', className }: ButtonProps) {
  const base: CSSProperties = {
    fontFamily: '"Geist", sans-serif',
    fontWeight: 500,
    letterSpacing: '-0.01em',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all 180ms cubic-bezier(.2,.8,.2,1)',
    width: full ? '100%' : 'auto',
    whiteSpace: 'nowrap',
    opacity: disabled ? 0.5 : 1,
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}
      onMouseOver={(e) => !disabled && (e.currentTarget.style.transform = 'translateY(-1px)')}
      onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {children}
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
    </button>
  );
}
