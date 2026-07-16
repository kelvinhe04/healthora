import { Children, isValidElement, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactElement, ReactNode, SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';

type OptionElement = ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>;

type SelectChangeEvent = { target: { value: string } };

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'multiple' | 'size'> & {
  onChange?: (event: SelectChangeEvent) => void;
  wrapperStyle?: CSSProperties;
};

function parseOptions(children: ReactNode) {
  return Children.toArray(children)
    .filter((child): child is OptionElement => isValidElement(child))
    .map((child) => ({
      value: String(child.props.value ?? ''),
      label: child.props.children,
      disabled: Boolean(child.props.disabled),
    }));
}

/**
 * Dropdown propio (issue #268) - un <select> nativo no permite estilizar el popup de opciones en
 * ningun navegador (solo la caja cerrada), asi que esto reemplaza el elemento entero por un boton +
 * un listbox propio (role="listbox"/"option", teclado, click-fuera-cierra). Conserva la misma API
 * externa que un <select> controlado (`value`, `onChange` con `.target.value`, `children` como
 * <option>) para no tener que tocar ningun caller existente.
 */
export function Select({
  value,
  onChange,
  children,
  className,
  style,
  wrapperStyle,
  disabled,
  id,
  'aria-label': ariaLabel,
  ...rest
}: SelectProps) {
  const options = parseOptions(children);
  const selectedIndex = options.findIndex((o) => o.value === String(value ?? ''));
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const listboxId = `${baseId}-listbox`;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    // Solo al abrir - no cada vez que cambia selectedIndex mientras esta abierto (eso pisaria la
    // navegacion por teclado en curso).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const firstEnabledIndex = () => options.findIndex((o) => !o.disabled);
  const lastEnabledIndex = () => {
    for (let i = options.length - 1; i >= 0; i--) if (!options[i].disabled) return i;
    return -1;
  };

  const moveActive = (dir: 1 | -1) => {
    if (options.length === 0) return;
    let next = activeIndex;
    for (let i = 0; i < options.length; i++) {
      next = (next + dir + options.length) % options.length;
      if (!options[next].disabled) break;
    }
    setActiveIndex(next);
  };

  const commit = (index: number) => {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    onChange?.({ target: { value: opt.value } });
    setOpen(false);
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveActive(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveActive(-1);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(firstEnabledIndex());
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(lastEnabledIndex());
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(activeIndex);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%', ...wrapperStyle }}>
      <button
        type="button"
        id={baseId}
        className={className ? `hlt-select ${className}` : 'hlt-select'}
        style={style}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        {...rest}
      >
        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? ' '}
        </span>
      </button>
      <Icon
        name="chevron-down"
        size={14}
        style={{
          position: 'absolute',
          top: '50%',
          right: 12,
          transform: open ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
          transition: 'transform 150ms ease',
          pointerEvents: 'none',
          color: 'var(--ink-60)',
        }}
      />
      {open && (
        <ul ref={listRef} id={listboxId} role="listbox" aria-labelledby={baseId} className="hlt-select-popup">
          {options.map((opt, index) => (
            <li
              key={`${opt.value}-${index}`}
              data-index={index}
              role="option"
              aria-selected={index === selectedIndex}
              aria-disabled={opt.disabled || undefined}
              className={['hlt-select-option', index === activeIndex ? 'is-active' : '', opt.disabled ? 'is-disabled' : ''].filter(Boolean).join(' ')}
              onMouseEnter={() => !opt.disabled && setActiveIndex(index)}
              onClick={() => commit(index)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
