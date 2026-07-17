import type { TFunction } from 'i18next';
import type { NotificationType } from '../types';

/** Icon + accent colour for each notification type, shared by the toaster and the notification
 * center so a given event always looks the same wherever it appears. Values reference the Icon
 * component's names and the app's CSS colour variables. */
export function notificationPresentation(
  type: NotificationType,
  data?: Record<string, unknown>,
): { icon: string; accent: string } {
  switch (type) {
    case 'order_paid':
      return { icon: 'check', accent: 'var(--green)' };
    case 'order_shipped':
      return { icon: 'truck', accent: 'var(--green)' };
    case 'order_status':
      // 'receipt' looks like a little ticket, too close to the box/package silhouette people
      // associate with "delivered" - split it off so entregado/retirado don't read the same as
      // "en preparación" at a glance.
      return (data?.fulfillmentStatus === 'delivered' || data?.fulfillmentStatus === 'picked_up')
        ? { icon: 'package', accent: 'var(--green)' }
        : { icon: 'receipt', accent: 'var(--ink)' };
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

/** Compact relative-time label, e.g. "now"/"ahora", "5 min ago"/"hace 5 min". `t` comes from the
 * calling component's useTranslation() - this isn't a component itself (HU-084). */
export function relativeTime(t: TFunction, iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 45) return t('notifications.relativeTime.now');
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return t('notifications.relativeTime.minutesAgo', { count: diffMin });
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return t('notifications.relativeTime.hoursAgo', { count: diffHour });
  const diffDay = Math.round(diffHour / 24);
  return t('notifications.relativeTime.daysAgo', { count: diffDay });
}
