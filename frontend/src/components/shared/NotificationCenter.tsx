import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { useNotificationLink } from '../../hooks/useNotificationLink';
import { notificationPresentation, relativeTime } from '../../lib/notificationPresentation';
import type { AppNotification } from '../../types';
import { Icon } from './Icon';

interface NotificationCenterProps {
  /** Style for the trigger button, so it matches the surrounding header icon cluster. */
  buttonStyle?: CSSProperties;
  iconSize?: number;
  /** Which side of the trigger button the panel hangs from. 'right' (default) anchors the
   * panel's right edge to the button - correct when the button sits near the right edge of the
   * screen (storefront header). Use 'left' when the button sits near the *left* edge instead
   * (e.g. the admin sidebar) - anchoring right there would push the ~360px panel off-screen. */
  panelAlign?: 'left' | 'right';
}

/** Bell trigger + dropdown panel: the persistent notification center (HU-061). Reads from the
 * shared inbox cache that the WebSocket also feeds, so it updates in real time and after a reload. */
export function NotificationCenter({ buttonStyle, iconSize = 18, panelAlign = 'right' }: NotificationCenterProps) {
  const { notifications, unread, markRead, markAllRead, dismiss, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'flex' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ ...buttonStyle, position: 'relative' }}
        aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : 'Notificaciones'}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Icon name="bell" size={iconSize} />
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -6,
              background: 'var(--coral)',
              color: 'white',
              fontSize: 10,
              fontFamily: '"JetBrains Mono", monospace',
              minWidth: 18,
              height: 18,
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              fontWeight: 700,
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Centro de notificaciones"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            ...(panelAlign === 'left' ? { left: 0 } : { right: 0 }),
            width: 'min(360px, calc(100vw - 32px))',
            maxHeight: 'min(70vh, 480px)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--cream)',
            border: '1px solid var(--ink-12)',
            borderRadius: 16,
            boxShadow: '0 24px 60px -24px rgba(0,0,0,0.4)',
            zIndex: 90,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: '1px solid var(--ink-06)',
            }}
          >
            <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 20, color: 'var(--ink)' }}>
              Notificaciones
            </span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {unread > 0 && (
                <button
                  onClick={() => markAllRead()}
                  style={headerActionStyle('var(--green)')}
                >
                  Marcar leídas
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={() => clearAll()}
                  style={headerActionStyle('var(--ink-40)')}
                >
                  Borrar todas
                </button>
              )}
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: 'var(--ink-40)',
                  fontSize: 13,
                }}
              >
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                  <Icon name="bell" size={28} stroke="var(--ink-20)" />
                </div>
                No tienes notificaciones todavía.
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onRead={() => markRead(notification.id)}
                  onDismiss={() => dismiss(notification.id)}
                  onClose={() => setOpen(false)}
                />
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div
              style={{
                padding: '8px 16px',
                borderTop: '1px solid var(--ink-06)',
                fontSize: 10.5,
                color: 'var(--ink-40)',
                fontFamily: '"JetBrains Mono", monospace',
                textAlign: 'center',
              }}
            >
              Las notificaciones se eliminan automáticamente después de 60 días
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function headerActionStyle(color: string): CSSProperties {
  return {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: '"Geist", sans-serif',
    padding: 0,
  };
}

function NotificationRow({
  notification,
  onRead,
  onDismiss,
  onClose,
}: {
  notification: AppNotification;
  onRead: () => void;
  onDismiss: () => void;
  onClose: () => void;
}) {
  const go = useNotificationLink();
  const { icon, accent } = notificationPresentation(notification.type);

  const handleActivate = () => {
    if (!notification.read) onRead();
    if (notification.link) {
      go(notification.link);
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        borderBottom: '1px solid var(--ink-04)',
        background: notification.read ? 'transparent' : 'var(--ink-04)',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleActivate}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleActivate();
          }
        }}
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          flex: 1,
          minWidth: 0,
          padding: '12px 8px 12px 16px',
          cursor: notification.link ? 'pointer' : 'default',
        }}
      >
        <span
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--cream-2)',
            color: accent,
          }}
        >
          <Icon name={icon} size={16} stroke={accent} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: notification.read ? 500 : 700,
              color: 'var(--ink)',
              marginBottom: 2,
            }}
          >
            {notification.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-60)', lineHeight: 1.35 }}>{notification.body}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-40)', marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>
            {relativeTime(notification.createdAt)}
          </div>
        </div>
        {!notification.read && (
          <span
            style={{
              flexShrink: 0,
              width: 8,
              height: 8,
              borderRadius: 999,
              background: 'var(--coral)',
              marginTop: 6,
            }}
          />
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        aria-label="Borrar notificación"
        style={{
          flexShrink: 0,
          alignSelf: 'stretch',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--ink-40)',
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
