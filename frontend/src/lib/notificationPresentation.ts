import type { NotificationType } from '../types';

/** Icon + accent colour for each notification type, shared by the toaster and the notification
 * center so a given event always looks the same wherever it appears. Values reference the Icon
 * component's names and the app's CSS colour variables. */
export function notificationPresentation(type: NotificationType): { icon: string; accent: string } {
  switch (type) {
    case 'order_paid':
      return { icon: 'check', accent: 'var(--green)' };
    case 'order_shipped':
      return { icon: 'truck', accent: 'var(--green)' };
    case 'order_status':
      return { icon: 'receipt', accent: 'var(--ink)' };
    case 'new_order':
      return { icon: 'bag', accent: 'var(--green)' };
    case 'low_stock':
      return { icon: 'alert-circle', accent: 'var(--coral)' };
    case 'new_review':
      return { icon: 'star', accent: 'var(--coral)' };
    case 'return_requested':
      return { icon: 'arrow-left', accent: 'var(--coral)' };
    case 'return_status':
      return { icon: 'arrow-left', accent: 'var(--ink)' };
    case 'broadcast':
    default:
      return { icon: 'bell', accent: 'var(--ink)' };
  }
}

/** Compact relative-time label (es), e.g. "ahora", "hace 5 min", "hace 2 h", "hace 3 d". */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 45) return 'ahora';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `hace ${diffHour} h`;
  const diffDay = Math.round(diffHour / 24);
  return `hace ${diffDay} d`;
}
