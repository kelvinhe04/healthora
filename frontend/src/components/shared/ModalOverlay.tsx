import { useEffect, useRef, useState, type ReactNode } from 'react';

interface ModalOverlayProps {
  open: boolean;
  onClose: () => void;
  zIndex?: number;
  overlayColor?: string;
  backdropFilter?: string;
  absolute?: boolean;
  children: ReactNode;
}

export function ModalOverlay({
  open,
  onClose,
  zIndex = 1000,
  overlayColor = 'rgba(17, 24, 20, 0.40)',
  backdropFilter,
  absolute = false,
  children,
}: ModalOverlayProps) {
  const [visible, setVisible] = useState(open);
  const [closing, setClosing] = useState(false);
  const frozenChildren = useRef<ReactNode>(children);

  // Freeze children snapshot so exit animation renders the last valid content.
  // Only update while open and not yet closing — preserves data during exit.
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
  }, [open]);

  if (!visible) return null;

  return (
    <div
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
        onClick={(e) => e.stopPropagation()}
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
