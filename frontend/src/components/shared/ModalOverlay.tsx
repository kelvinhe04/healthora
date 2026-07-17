import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface ModalOverlayProps {
  open: boolean;
  onClose: () => void;
  zIndex?: number;
  overlayColor?: string;
  backdropFilter?: string;
  absolute?: boolean;
  /** Accessible name when no visible title is wired via aria-labelledby */
  ariaLabel?: string;
  ariaLabelledBy?: string;
  children: ReactNode;
}

export function ModalOverlay({
  open,
  onClose,
  zIndex = 1000,
  overlayColor = 'rgba(17, 24, 20, 0.40)',
  backdropFilter,
  absolute = false,
  ariaLabel,
  ariaLabelledBy,
  children,
}: ModalOverlayProps) {
  const { t } = useTranslation();
  const resolvedAriaLabel = ariaLabel ?? t('common.modalDialogAria');
  const [visible, setVisible] = useState(open);
  const [closing, setClosing] = useState(false);
  const frozenChildren = useRef<ReactNode>(children);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  if (open && !closing) frozenChildren.current = children;

  useEffect(() => {
    if (open) {
      setVisible(true);
      setClosing(false);
    } else if (visible) {
      setClosing(true);
      const t = setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 220);
      return () => clearTimeout(t);
    }
  }, [open, visible]);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);

      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      // `preventScroll` stops the browser from scrolling ancestor containers (the admin's
      // `<main overflow: auto>`) to "reveal" the newly focused field - without it, focusing an
      // element inside this `position: fixed` modal was yanking the page behind it to the top.
      focusables?.[0]?.focus({ preventScroll: true });
    }, 0);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      previousFocusRef.current?.focus?.({ preventScroll: true });
    };
    // `onClose` deliberately excluded: consumers pass a fresh arrow function on every render
    // (e.g. `onClose={() => setOpen(false)}`), and including it here would re-run this effect -
    // and its steal-focus-to-the-first-field setTimeout - on every keystroke inside the modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!visible) return null;

  return (
    <div
      role="presentation"
      onClick={closing ? undefined : onClose}
      style={{
        position: absolute ? 'absolute' : 'fixed',
        inset: 0,
        background: overlayColor,
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        ...(backdropFilter ? { backdropFilter } : {}),
        animation: `${closing ? 'modal-bg-out' : 'modal-bg-in'} 200ms ease forwards`,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabelledBy ? undefined : resolvedAriaLabel}
        aria-labelledby={ariaLabelledBy}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          animation: `${closing ? 'modal-card-out' : 'modal-card-in'} 240ms cubic-bezier(0.34, 1.2, 0.64, 1) forwards`,
        }}
      >
        {frozenChildren.current}
      </div>
    </div>
  );
}
