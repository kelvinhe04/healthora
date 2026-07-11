import { Order } from '../db/models/Order';
import { Product } from '../db/models/Product';
import { decrementStock } from './inventory';
import { scanAndNotifyLowStock } from './lowStock';

export const RETURN_WINDOW_DAYS = 30;

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
    fulfillmentStatus: 'unfulfilled',
    status: 'paid',
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
