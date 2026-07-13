import { z } from 'zod';
import { ProductSubscription } from '../db/models/ProductSubscription';
import { Order } from '../db/models/Order';
import { Product } from '../db/models/Product';
import { stripe } from './stripe';
import { decrementStock } from './inventory';
import { sendOrderConfirmationEmail } from './email';
import { notifyAdmins, notifyUser } from './realtime';
import { scanAndNotifyLowStock } from './lowStock';
import { recalculateAfterPayment } from './bestsellers';
import {
  emailField,
  intFromInput,
  moneyFromInput,
  optionalTextField,
  orderAddressSchema,
  productIdSchema,
  shippingMethodSchema,
  textField,
} from './validation';
import { SUBSCRIPTION_INTERVAL_DAYS } from '../db/models/ProductSubscription';

export const subscriptionCheckoutMetadataSchema = z.object({
  customerId: textField(180),
  customerName: optionalTextField(160),
  customerEmail: emailField().optional(),
  productId: productIdSchema,
  productName: textField(200),
  variantId: optionalTextField(180),
  variantLabel: optionalTextField(200),
  imageUrl: optionalTextField(2000),
  category: optionalTextField(120),
  taxExempt: z.enum(['true', 'false']).default('false'),
  qty: intFromInput(1, 999),
  unitPrice: moneyFromInput(),
  subtotal: moneyFromInput(),
  tax: moneyFromInput(),
  shipping: moneyFromInput(),
  total: moneyFromInput(),
  intervalDays: z.coerce.number().int().refine((value) => (SUBSCRIPTION_INTERVAL_DAYS as readonly number[]).includes(value)),
  shippingMethod: shippingMethodSchema,
  shippingLabel: optionalTextField(160),
  shippingEta: optionalTextField(80),
  address: textField(5000),
});

type SubscriptionDoc = InstanceType<typeof ProductSubscription>;

/** Builds and fulfills a renewal order from a subscription's locked-in snapshot (price/product/
 * address never re-derived from live data) - used both for the first shipment (right after
 * checkout) and every later renewal, so both paths stay in sync automatically. Mirrors the
 * fulfillment steps of a normal paid order (webhooks.ts): stock decrement, confirmation email,
 * realtime notifications, low-stock scan and bestseller recompute are all best-effort, exactly
 * like the one-time checkout flow - a failure in any of them must never block order creation.
 */
export async function createSubscriptionOrder(sub: SubscriptionDoc) {
  const lineItem = {
    productId: sub.productId,
    productName: sub.productName,
    qty: sub.qty,
    price: sub.unitPrice,
    imageUrl: sub.imageUrl,
    category: sub.category,
    variantId: sub.variantId || undefined,
    variantLabel: sub.variantLabel || undefined,
    isSample: false,
    taxExempt: sub.taxExempt,
  };

  const order = await Order.create({
    customerId: sub.customerId,
    customerName: sub.customerName,
    customerEmail: sub.customerEmail,
    items: [lineItem],
    subtotal: sub.subtotal,
    tax: sub.tax,
    shipping: sub.shipping,
    shippingMethod: sub.shippingMethod,
    shippingLabel: sub.shippingLabel,
    shippingEta: sub.shippingEta,
    total: sub.total,
    paymentStatus: 'paid',
    fulfillmentStatus: 'unfulfilled',
    status: 'paid',
    address: sub.address,
    subscriptionId: sub._id,
  });

  const stockOk = await decrementStock(sub.productId, sub.qty, sub.variantId || undefined);
  if (!stockOk) {
    console.error('[SUBSCRIPTIONS] Stock decrement failed for', sub.productId, sub.variantId);
  }

  if (sub.customerEmail) {
    try {
      await sendOrderConfirmationEmail({
        customerName: sub.customerName || 'cliente',
        customerEmail: sub.customerEmail,
        orderId: order._id.toString(),
        items: [lineItem],
        subtotal: sub.subtotal,
        tax: sub.tax,
        shipping: sub.shipping,
        shippingLabel: sub.shippingLabel,
        shippingEta: sub.shippingEta,
        shippingMethod: sub.shippingMethod,
        total: sub.total,
        address: sub.address,
        createdAt: order.createdAt,
      });
    } catch (emailError) {
      console.error('[SUBSCRIPTIONS] Confirmation email failed:', emailError);
    }
  }

  try {
    await notifyUser(sub.customerId, {
      type: 'order_paid',
      title: 'Reposición automática',
      body: `Generamos tu pedido de reposición automática por $${sub.total.toFixed(2)}.`,
      link: '/orders',
      data: { orderId: order._id.toString(), total: sub.total },
    });
  } catch (notifyError) {
    console.error('[SUBSCRIPTIONS] order_paid notification failed:', notifyError);
  }

  try {
    await notifyAdmins({
      type: 'new_order',
      title: 'Nuevo pedido (reposición automática)',
      body: `${sub.customerName || 'Un cliente'} recibió una reposición automática de $${sub.total.toFixed(2)} (#${order._id.toString().slice(-8).toUpperCase()}).`,
      link: '/admin?section=orders',
      data: { orderId: order._id.toString(), total: sub.total },
    });
  } catch (notifyError) {
    console.error('[SUBSCRIPTIONS] new_order admin notification failed:', notifyError);
  }

  try {
    const product = await Product.findOne({ id: sub.productId }).lean();
    if (product) await scanAndNotifyLowStock(product);
  } catch (notifyError) {
    console.error('[SUBSCRIPTIONS] low_stock notification failed:', notifyError);
  }

  recalculateAfterPayment();

  return order;
}

/** `checkout.session.completed` (mode=subscription) - creates the subscription record itself
 * plus its first shipment order. Idempotent on `stripeSubscriptionId` so a webhook retry doesn't
 * create a duplicate subscription/order. */
export async function handleSubscriptionCheckoutCompleted(session: {
  subscription?: string;
  customer?: string;
  metadata?: Record<string, string>;
}) {
  if (!session.subscription || !session.customer) {
    console.error('[SUBSCRIPTIONS] checkout.session.completed missing subscription/customer id');
    return;
  }

  const existing = await ProductSubscription.findOne({ stripeSubscriptionId: session.subscription }).lean();
  if (existing) {
    console.log('[SUBSCRIPTIONS] Subscription already exists for', session.subscription);
    return;
  }

  const parsed = subscriptionCheckoutMetadataSchema.safeParse(session.metadata || {});
  if (!parsed.success) {
    console.error('[SUBSCRIPTIONS] Invalid checkout metadata:', parsed.error.issues);
    return;
  }
  const metadata = parsed.data;

  let address;
  try {
    address = orderAddressSchema.parse(JSON.parse(metadata.address));
  } catch (error) {
    console.error('[SUBSCRIPTIONS] Invalid address metadata:', error);
    return;
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);
  const nextBillingDate = stripeSubscription.current_period_end
    ? new Date(stripeSubscription.current_period_end * 1000)
    : undefined;

  const sub = await ProductSubscription.create({
    customerId: metadata.customerId,
    customerName: metadata.customerName,
    customerEmail: metadata.customerEmail,
    productId: metadata.productId,
    productName: metadata.productName,
    variantId: metadata.variantId || undefined,
    variantLabel: metadata.variantLabel || undefined,
    imageUrl: metadata.imageUrl,
    category: metadata.category,
    taxExempt: metadata.taxExempt === 'true',
    qty: metadata.qty,
    unitPrice: metadata.unitPrice,
    subtotal: metadata.subtotal,
    tax: metadata.tax,
    shipping: metadata.shipping,
    total: metadata.total,
    intervalDays: metadata.intervalDays,
    status: 'active',
    nextBillingDate,
    stripeSubscriptionId: session.subscription,
    stripeCustomerId: session.customer,
    shippingMethod: metadata.shippingMethod,
    shippingLabel: metadata.shippingLabel,
    shippingEta: metadata.shippingEta,
    address,
  });

  await createSubscriptionOrder(sub);

  try {
    await notifyUser(sub.customerId, {
      type: 'order_paid',
      title: 'Suscripción activada',
      body: `Tu reposición automática de ${sub.productName} quedó activa (cada ${sub.intervalDays} días).`,
      link: '/profile',
      data: { subscriptionId: sub._id.toString() },
    });
  } catch (notifyError) {
    console.error('[SUBSCRIPTIONS] subscription activated notification failed:', notifyError);
  }
}

/** `invoice.payment_succeeded` - only reacts to renewal cycles (`billing_reason ===
 * 'subscription_cycle'`); the very first invoice (`subscription_create`) is already handled by
 * `handleSubscriptionCheckoutCompleted` above, which has the full metadata on hand instead of
 * having to look it up from a bare invoice payload. */
export async function handleSubscriptionInvoicePaid(invoice: {
  subscription?: string | null;
  billing_reason?: string | null;
  period_end?: number;
}) {
  if (invoice.billing_reason !== 'subscription_cycle' || !invoice.subscription) return;

  const sub = await ProductSubscription.findOne({ stripeSubscriptionId: invoice.subscription });
  if (!sub) {
    console.error('[SUBSCRIPTIONS] No local subscription found for renewal of', invoice.subscription);
    return;
  }
  if (sub.status === 'canceled') {
    console.log('[SUBSCRIPTIONS] Ignoring renewal invoice for canceled subscription', invoice.subscription);
    return;
  }

  await createSubscriptionOrder(sub);

  if (invoice.period_end) {
    sub.nextBillingDate = new Date(invoice.period_end * 1000);
  }
  sub.status = 'active';
  await sub.save();
}

/** `customer.subscription.deleted` - covers cancellation from the Stripe dashboard too, not just
 * our own DELETE /subscriptions/:id endpoint. */
export async function handleSubscriptionCanceled(subscription: { id: string }) {
  await ProductSubscription.updateOne(
    { stripeSubscriptionId: subscription.id },
    { $set: { status: 'canceled' } },
  );
}
