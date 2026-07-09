import { useEffect } from 'react';
import { useNotificationToastStore, type Toast } from '../../store/notificationToastStore';
import { useNotificationLink } from '../../hooks/useNotificationLink';
import { notificationPresentation } from '../../lib/notificationPresentation';
import { Icon } from './Icon';

const AUTO_DISMISS_MS = 6000;

/** Renders the transient toast stack (bottom-right) for notifications arriving over the WebSocket.
 * Mounted once at the app root alongside NotificationsRealtime. */
export function NotificationToaster() {
  const toasts = useNotificationToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 20,
        bottom: 92,
        zIndex: 120,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 'min(360px, calc(100vw - 32px))',
        pointerEvents: 'none',
      }}
      aria-live="polite"
      role="status"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const dismiss = useNotificationToastStore((s) => s.dismiss);
  const go = useNotificationLink();
  const { icon, accent } = notificationPresentation(toast.notification.type);

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [dismiss, toast.id]);

  const { title, body, link } = toast.notification;

  return (
    <div
      onClick={() => {
        if (link) go(link);
        dismiss(toast.id);
      }}
      style={{
        pointerEvents: 'auto',
        cursor: link ? 'pointer' : 'default',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        background: 'var(--cream)',
        border: '1px solid var(--ink-12)',
        borderRadius: 14,
        padding: '12px 14px',
        boxShadow: '0 18px 40px -18px rgba(0,0,0,0.35)',
        animation: 'toast-in 260ms cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: none; } }`}</style>
      <span
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--ink-04)',
          color: accent,
        }}
      >
        <Icon name={icon} size={16} stroke={accent} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-60)', lineHeight: 1.35 }}>{body}</div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          dismiss(toast.id);
        }}
        aria-label="Descartar"
        style={{
          flexShrink: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--ink-40)',
          padding: 2,
          display: 'flex',
        }}
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
