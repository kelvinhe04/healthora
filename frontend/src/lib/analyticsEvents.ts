import posthog from 'posthog-js';
import { isPostHogConfigured } from './posthog';

/** Custom funnel events for the admin product analytics panel (HU-054) - PostHog's autocapture
 * already covers pageviews/clicks, but the checkout funnel and cart abandonment need explicit
 * business events to query against (see backend/src/lib/posthogAnalytics.ts). No-ops when
 * PostHog isn't configured, same guard used by the rest of the frontend's PostHog usage. */

export function trackAddToCart(productId: string, productName: string, price: number, qty: number): void {
  if (!isPostHogConfigured) return;
  posthog.capture('add_to_cart', { product_id: productId, product_name: productName, price, qty });
}

export function trackCheckoutStarted(itemCount: number, subtotal: number): void {
  if (!isPostHogConfigured) return;
  posthog.capture('checkout_started', { item_count: itemCount, subtotal });
}

export function trackCheckoutCompleted(orderId: string, total: number): void {
  if (!isPostHogConfigured) return;
  posthog.capture('checkout_completed', { order_id: orderId, total });
}
