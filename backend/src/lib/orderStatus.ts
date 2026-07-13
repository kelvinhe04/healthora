export type PaymentStatus = 'pending_payment' | 'paid' | 'cancelled' | 'refunded';
// `picked_up` only applies to pickup orders: `delivered` means "ready at the store", `picked_up`
// means the customer actually came and got it - see combineOrderStatus below for how it folds
// into the legacy `status` field, and routes/returns.ts for why the distinction matters (a return
// only makes sense once the customer actually has the product).
export type FulfillmentStatus = 'unfulfilled' | 'processing' | 'shipped' | 'delivered' | 'picked_up' | 'cancelled';
export type LegacyOrderStatus = 'pending_payment' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export function deriveStatusesFromLegacy(status?: string | null): { paymentStatus: PaymentStatus; fulfillmentStatus: FulfillmentStatus } {
  switch (status) {
    case 'processing':
      return { paymentStatus: 'paid', fulfillmentStatus: 'processing' };
    case 'shipped':
      return { paymentStatus: 'paid', fulfillmentStatus: 'shipped' };
    case 'delivered':
      return { paymentStatus: 'paid', fulfillmentStatus: 'delivered' };
    case 'paid':
      return { paymentStatus: 'paid', fulfillmentStatus: 'unfulfilled' };
    case 'cancelled':
      return { paymentStatus: 'cancelled', fulfillmentStatus: 'cancelled' };
    case 'refunded':
      return { paymentStatus: 'refunded', fulfillmentStatus: 'cancelled' };
    case 'pending_payment':
    default:
      return { paymentStatus: 'pending_payment', fulfillmentStatus: 'unfulfilled' };
  }
}

export function combineOrderStatus(paymentStatus: PaymentStatus, fulfillmentStatus: FulfillmentStatus): LegacyOrderStatus {
  if (paymentStatus === 'refunded') return 'refunded';
  if (paymentStatus === 'cancelled' || fulfillmentStatus === 'cancelled') return 'cancelled';
  if (paymentStatus === 'pending_payment') return 'pending_payment';
  // Same coarse legacy bucket as `delivered` - both mean "fulfillment is done" for anything that
  // only reads the legacy `status` (e.g. STATUS_CFG coloring). The delivered-vs-picked_up
  // distinction lives in `fulfillmentStatus` itself for callers that need it.
  if (fulfillmentStatus === 'picked_up' || fulfillmentStatus === 'delivered') return 'delivered';
  if (fulfillmentStatus === 'shipped') return 'shipped';
  if (fulfillmentStatus === 'processing') return 'processing';
  return 'paid';
}

export function normalizeOrder<T extends { status?: string; paymentStatus?: PaymentStatus; fulfillmentStatus?: FulfillmentStatus }>(order: T) {
  const derived = deriveStatusesFromLegacy(order.status);
  const paymentStatus = order.paymentStatus || derived.paymentStatus;
  const fulfillmentStatus = order.fulfillmentStatus || derived.fulfillmentStatus;

  return {
    ...order,
    paymentStatus,
    fulfillmentStatus,
    status: combineOrderStatus(paymentStatus, fulfillmentStatus),
  };
}
