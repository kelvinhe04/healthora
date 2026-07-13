import { Order } from '../db/models/Order';
import { Product } from '../db/models/Product';
import { Return } from '../db/models/Return';
import { decrementStock } from './inventory';
import { scanAndNotifyLowStock } from './lowStock';
import { getReturnStatusCopy } from './email';
import { enqueueEmailJob } from './jobQueue';
import { notifyAdmins, notifyUser } from './realtime';
import { stripe } from './stripe';

export const RETURN_WINDOW_DAYS = 30;

export type ReasonCategory = 'damaged' | 'wrong_item' | 'defective' | 'changed_mind' | 'other';

// Categories where the customer got a bad product through no fault of their own (warehouse packed
// the wrong item, courier damaged it, unit doesn't work) - the store also eats the shipping cost on
// a refund. changed_mind/other are the customer's own call, so only the item price comes back.
const STORE_FAULT_REASONS = new Set<ReasonCategory>(['damaged', 'wrong_item', 'defective']);

export function refundIncludesShipping(reasonCategory: ReasonCategory): boolean {
  return STORE_FAULT_REASONS.has(reasonCategory);
}

export function isWithinReturnWindow(order: { createdAt: Date | string }, now: Date = new Date()): boolean {
  const orderDate = new Date(order.createdAt);
  const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= RETURN_WINDOW_DAYS;
}

type OriginalOrderItem = {
  productId: string;
  productName: string;
  qty: number;
  price: number;
  imageUrl?: string;
  category?: string;
  variantId?: string;
  variantLabel?: string;
  isSample?: boolean;
  taxExempt?: boolean;
};

type OriginalOrder = {
  _id: unknown;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  items: OriginalOrderItem[];
  shippingMethod?: 'delivery' | 'pickup';
  shippingLabel?: string;
  shippingEta?: string;
  address?: { name?: string; phone?: string; address?: string; city?: string; postal?: string };
};

/**
 * Resolves the wrong/damaged-item case: instead of refunding, ship the customer the product they
 * actually ordered, at no additional charge. Re-uses the *original* order's line items (price,
 * variant, image, etc.) for whatever was returned - the return only carries productId/qty, not the
 * full line - and creates a normal Order for it (paymentStatus already `paid`, nothing to charge
 * again, so `total`/`subtotal`/`tax`/`shipping` are all 0). Real stock is decremented same as any
 * other order (best-effort, mirrors the webhook's paid-order handler) since a real unit is leaving
 * the warehouse again.
 */
export async function createReplacementOrder(originalOrder: OriginalOrder, returnItems: { productId: string; qty: number }[]) {
  const items = returnItems.map((returnItem) => {
    const original = originalOrder.items.find((oi) => oi.productId === returnItem.productId);
    return {
      productId: returnItem.productId,
      productName: original?.productName ?? returnItem.productId,
      qty: returnItem.qty,
      price: 0,
      imageUrl: original?.imageUrl,
      category: original?.category,
      variantId: original?.variantId,
      variantLabel: original?.variantLabel,
      isSample: original?.isSample ?? false,
      taxExempt: original?.taxExempt ?? false,
    };
  });

  // A store-dropoff replacement is handed over at the same counter the customer just returned the
  // wrong item to - there's no preparing/shipping leg to track, so it starts already at the
  // pickup-flow's "listo para retirar" milestone instead of `unfulfilled`. A courier replacement
  // still has to be packed and shipped for real, so that one keeps the normal fulfillment sequence.
  const isStorePickup = originalOrder.shippingMethod === 'pickup';

  const replacementOrder = await Order.create({
    customerId: originalOrder.customerId,
    customerName: originalOrder.customerName,
    customerEmail: originalOrder.customerEmail,
    items,
    subtotal: 0,
    tax: 0,
    shipping: 0,
    total: 0,
    shippingMethod: originalOrder.shippingMethod,
    shippingLabel: originalOrder.shippingLabel,
    shippingEta: originalOrder.shippingEta,
    paymentStatus: 'paid',
    fulfillmentStatus: isStorePickup ? 'delivered' : 'unfulfilled',
    status: isStorePickup ? 'delivered' : 'paid',
    address: originalOrder.address,
    replacesOrderId: originalOrder._id,
  });

  for (const item of items) {
    if (item.isSample) continue;
    const ok = await decrementStock(item.productId, item.qty, item.variantId);
    if (!ok) {
      console.error('[RETURNS] Stock decrement failed for replacement order', item.productId, item.variantId);
    }
  }

  try {
    const shippedProductIds = [...new Set(items.filter((i) => !i.isSample).map((i) => i.productId))];
    const shippedProducts = await Product.find({ id: { $in: shippedProductIds } }).lean();
    for (const product of shippedProducts) {
      await scanAndNotifyLowStock(product);
    }
  } catch (notifyError) {
    console.error('[RETURNS] low_stock notification failed for replacement order:', notifyError);
  }

  return replacementOrder;
}

/**
 * Source of truth for "did the refund actually go through" - mirrors how order payment only
 * counts as confirmed once the `checkout.session.completed` webhook fires, not the moment the
 * synchronous Stripe API call returns. `adminReturns.ts` only *requests* the refund and parks the
 * return in `refund_pending`; this is what Stripe's `refund.updated` webhook calls once it knows
 * the real outcome.
 */
export async function confirmReturnRefund(stripeRefundId: string, stripeStatus: string) {
  const returnDoc = await Return.findOne({ stripeRefundId });
  // Not found (refund unrelated to a return) or already resolved (duplicate webhook delivery -
  // Stripe retries these) - either way, nothing to do.
  if (!returnDoc || returnDoc.status !== 'refund_pending') return;

  if (stripeStatus === 'succeeded') {
    returnDoc.status = 'refunded';
    await returnDoc.save();
    await Order.updateOne({ _id: returnDoc.orderId }, { paymentStatus: 'refunded', status: 'refunded' });

    enqueueEmailJob('return_status', {
      customerName: returnDoc.customerName || 'cliente',
      customerEmail: returnDoc.customerEmail || '',
      orderId: String(returnDoc.orderId),
      status: 'refunded',
      refundAmount: returnDoc.refundAmount,
      returnMethod: returnDoc.returnMethod as 'courier_pickup' | 'store_dropoff' | undefined,
    }).catch((err) => console.error('[RETURNS] Failed to queue refunded email:', err));

    if (returnDoc.customerId) {
      try {
        const copy = getReturnStatusCopy('refunded', returnDoc.returnMethod);
        await notifyUser(returnDoc.customerId, {
          type: 'return_status',
          title: copy.label,
          body: copy.message,
          link: '/orders',
          data: { returnId: returnDoc._id.toString(), orderId: String(returnDoc.orderId), status: 'refunded' },
        });
      } catch (notifyError) {
        console.error('[RETURNS] Failed to push refunded notification:', notifyError);
      }
    }
    return;
  }

  if (stripeStatus === 'failed' || stripeStatus === 'canceled') {
    // Back to in_review so the admin sees it needs attention and can retry, instead of the
    // return silently stalling in refund_pending forever.
    returnDoc.status = 'in_review';
    await returnDoc.save();
    try {
      await notifyAdmins({
        type: 'return_status',
        title: 'Reembolso falló',
        body: `El reembolso de $${returnDoc.refundAmount.toFixed(2)} para el pedido #${String(returnDoc.orderId).slice(-8).toUpperCase()} falló en Stripe. Revisa e intenta de nuevo.`,
        link: '/admin?section=returns',
        data: { returnId: returnDoc._id.toString(), orderId: String(returnDoc.orderId) },
      });
    } catch (notifyError) {
      console.error('[RETURNS] Failed to push refund-failed notification:', notifyError);
    }
  }

  // Any other Stripe status (e.g. still `pending`) - no-op, wait for the next webhook delivery.
}

/**
 * Self-heals `refund_pending` returns that never got a `refund.updated` webhook - the most common
 * case being local dev, where nothing is forwarding Stripe events unless `stripe listen` is
 * running (see README). Mirrors the `GET /orders?stripeSessionId=` fallback for payment
 * confirmation: the webhook is the fast, event-driven path in production, this is the safety net
 * that keeps the list endpoints accurate even if it never arrives. Called from the returns list
 * routes (customer + admin) before responding - cheap no-op when nothing is pending.
 */
export async function resolvePendingRefunds(): Promise<void> {
  const pending = await Return.find({ status: 'refund_pending' }).lean();
  if (!pending.length) return;

  await Promise.all(
    pending.map(async (r) => {
      if (!r.stripeRefundId) return;
      try {
        const refund = await stripe.refunds.retrieve(r.stripeRefundId);
        await confirmReturnRefund(r.stripeRefundId, refund.status ?? '');
      } catch (error) {
        console.error('[RETURNS] Failed to poll refund status for', r._id, error);
      }
    }),
  );
}
