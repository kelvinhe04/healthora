import { forwardRef } from 'react';
import type { CSSProperties, SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { wrapperStyle?: CSSProperties };

/** Reemplaza el <select> default del navegador (issue #268): mismo elemento nativo (conserva
 * teclado, lector de pantalla y el picker nativo en mobile) solo restyleado via `.hlt-select`
 * (appearance:none), con la flecha reemplazada por un Icon superpuesto. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, style, wrapperStyle, children, ...props }, ref) {
    return (
      <div style={{ position: 'relative', width: '100%', ...wrapperStyle }}>
        <select
          ref={ref}
          className={className ? `hlt-select ${className}` : 'hlt-select'}
          style={style}
          {...props}
        >
          {children}
        </select>
        <Icon
          name="chevron-down"
          size={14}
          style={{ position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--ink-60)' }}
        />
      </div>
    );
  },
);
