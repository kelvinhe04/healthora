import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

/** Reemplaza el checkbox default del navegador (issue #268) - solo el input, sin envolver en
 * label/layout propio, para que cada caller mantenga su estructura actual (algunos ya tienen un
 * <label> con texto/spans condicionales alrededor). */
export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={className ? `hlt-checkbox ${className}` : 'hlt-checkbox'}
        {...props}
      />
    );
  },
);
