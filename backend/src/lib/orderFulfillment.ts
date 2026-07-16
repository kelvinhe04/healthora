import { z } from 'zod';
import { Order } from '../db/models/Order';
import { Product } from '../db/models/Product';
import { sendOrderConfirmationEmail } from './email';
import { recalculateAfterPayment } from './bestsellers';
import { cartItemSchema, emailField, moneyFromInput, optionalTextField, orderAddressSchema, shippingMethodSchema, textField } from './validation';
import { buildPaidLineItem } from './productVariants';
import { decrementStock, validateCartStock } from './inventory';
import { notifyAdmins, notifyUser } from './realtime';
import { scanAndNotifyLowStock } from './lowStock';
import { recordCouponRedemption } from './promotions';
import { computePointsEarned, getLoyaltyRates, settleLoyaltyForOrder } from './loyalty';
import { getSettings } from '../db/models/Settings';

export const orderCartItemSchema = cartItemSchema.extend({
  isSample: z.coerce.boolean().optional(),
});

export const orderMetadataSchema = z.object({
  customerId: textField(180),
  customerName: optionalTextField(160),
  customerEmail: emailField().optional(),
  cartItems: textField(20000),
  address: textField(5000),
  discountCode: optionalTextField(80),
  discountAmount: moneyFromInput().default(0),
  loyaltyPointsRedeemed: z.coerce.number().int().min(0).default(0),
  loyaltyDiscountAmount: moneyFromInput().default(0),
  tax: moneyFromInput().default(0),
  shipping: moneyFromInput().default(0),
  shippingMethod: shippingMethodSchema.optional(),
  shippingLabel: optionalTextField(160),
  shippingEta: optionalTextField(80),
});

export type OrderMetadata = z.infer<typeof orderMetadataSchema>;

type OrderCartItem = z.infer<typeof orderCartItemSchema>;

export function parseOrderJsonMetadata<T>(value: string, schema: z.ZodType<T>) {
  try {
    return schema.safeParse(JSON.parse(value));
  } catch {
    return schema.safeParse(null);
  }
}

/**
 * Turns a paid Stripe event (Checkout Session or PaymentIntent) into an Order: parses the
 * cartItems/address metadata we wrote at checkout time, validates stock, creates the Order,
 * decrements stock, sends the confirmation email, pushes realtime notifications, records the
 * coupon redemption and recalculates bestsellers. Shared by webhooks.ts
 * (`checkout.session.completed`, `payment_intent.succeeded`) and orders.ts's poll-before-webhook
 * fallback (`GET /orders?stripeSessionId=` / `?stripePaymentIntentId=`) - those three call sites
 * used to duplicate this block, which had drifted (only the webhook path validated stock and
 * recorded coupon redemptions). Throws on any validation failure; callers decide the HTTP response.
 */
export async function createPaidOrder(params: {
  metadata: OrderMetadata;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  customerEmailFallback?: string;
}) {
  const { metadata, stripeSessionId, stripePaymentIntentId, customerEmailFallback } = params;

  const parsedCartItems = parseOrderJsonMetadata(metadata.cartItems, z.array(orderCartItemSchema).min(1).max(100));
  if (!parsedCartItems.success) throw new Error('Invalid checkout cart metadata');

  const parsedAddress = parseOrderJsonMetadata(metadata.address, orderAddressSchema);
  if (!parsedAddress.success) throw new Error('Invalid checkout address metadata');

  const cartItems = parsedCartItems.data as OrderCartItem[];
  const parsedAddressData = parsedAddress.data as { name: string; phone: string; address?: string; city?: string; postal?: string };
  const address = {
    name: parsedAddressData.name,
    phone: parsedAddressData.phone,
    address: parsedAddressData.address || '',
    city: parsedAddressData.city || '',
    postal: parsedAddressData.postal || '',
  };

  const productIds = [...new Set(cartItems.map((item) => item.productId))];
  const products = await Product.find({ id: { $in: productIds }, active: true }).lean();
  if (products.length !== productIds.length) throw new Error('Missing products for paid order');

  validateCartStock(products, cartItems);
  const lineItems = cartItems.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product) throw new Error(`Product not found for ${item.productId}`);
    return buildPaidLineItem(product, item);
  });

  const subtotal = lineItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discountCode = metadata.discountCode || undefined;
  const discountAmount = metadata.discountAmount;
  const loyaltyPointsRedeemed = metadata.loyaltyPointsRedeemed;
  const loyaltyDiscountAmount = metadata.loyaltyDiscountAmount;
  const tax = metadata.tax;
  const shipping = metadata.shipping;
  const total = Math.round((subtotal - discountAmount - loyaltyDiscountAmount + tax + shipping) * 100) / 100;

  const loyaltySettings = await getSettings();
  const loyaltyPointsEarned = computePointsEarned(total, getLoyaltyRates(loyaltySettings).pointsPerDollar);

  const order = await Order.create({
    customerId: metadata.customerId,
    customerName: metadata.customerName,
    customerEmail: metadata.customerEmail || customerEmailFallback,
    items: lineItems,
    subtotal,
    discountCode,
    discountAmount,
    loyaltyPointsRedeemed,
    loyaltyDiscountAmount,
    loyaltyPointsEarned,
    tax,
    shipping,
    shippingMethod: metadata.shippingMethod,
    shippingLabel: metadata.shippingLabel,
    shippingEta: metadata.shippingEta,
    total,
    paymentStatus: 'paid',
    fulfillmentStatus: 'unfulfilled',
    status: 'paid',
    stripeSessionId,
    stripePaymentIntentId,
    address,
  });

  if (discountCode) {
    await recordCouponRedemption(discountCode);
  }

  try {
    await settleLoyaltyForOrder(order);
  } catch (loyaltyError) {
    console.error('[ORDER_FULFILLMENT] Failed to settle loyalty points:', loyaltyError);
  }

  const customerEmail = metadata.customerEmail || customerEmailFallback;
  if (customerEmail) {
    // Not awaited: SMTP can take several seconds to respond (and, e.g., Gmail's daily send-limit
    // rejection is itself a slow round-trip) - the webhook handler shouldn't block its response
    // on it. Errors are still caught and logged, just asynchronously.
    sendOrderConfirmationEmail({
      customerName: metadata.customerName || 'cliente',
      customerEmail,
      orderId: order._id.toString(),
      items: lineItems,
      subtotal,
      discountCode,
      discountAmount,
      tax,
      shipping,
      shippingLabel: metadata.shippingLabel,
      shippingEta: metadata.shippingEta,
      shippingMethod: metadata.shippingMethod,
      total,
      address,
      createdAt: order.createdAt,
    }).catch((emailError) => {
      console.error('[ORDER_FULFILLMENT] Failed to send confirmation email:', emailError);
    });
  }

  for (const item of lineItems) {
    if (item.isSample) continue;
    const ok = await decrementStock(item.productId, item.qty, item.variantId);
    if (!ok) {
      console.error('[ORDER_FULFILLMENT] Stock decrement failed for', item.productId, item.variantId);
    }
  }

  // Real-time notifications (HU-061). Best-effort: a notification failure must never break the
  // paid-order flow, so each push is guarded independently.
  try {
    await notifyUser(metadata.customerId, {
      type: 'order_paid',
      title: 'Pago confirmado',
      body: `Recibimos tu pago de $${total.toFixed(2)}. Tu pedido está en preparación.`,
      link: '/orders',
      data: { orderId: order._id.toString(), total },
    });
  } catch (notifyError) {
    console.error('[ORDER_FULFILLMENT] order_paid notification failed:', notifyError);
  }

  try {
    await notifyAdmins({
      type: 'new_order',
      title: 'Nuevo pedido',
      body: `${metadata.customerName || 'Un cliente'} hizo un pedido de $${total.toFixed(2)} (#${order._id.toString().slice(-8).toUpperCase()}).`,
      link: '/admin?section=orders',
      data: { orderId: order._id.toString(), total },
    });
  } catch (notifyError) {
    console.error('[ORDER_FULFILLMENT] new_order admin notification failed:', notifyError);
  }

  try {
    const soldProductIds = [...new Set(lineItems.filter((i) => !i.isSample).map((i) => i.productId))];
    const soldProducts = await Product.find({ id: { $in: soldProductIds } }).lean();
    for (const product of soldProducts) {
      await scanAndNotifyLowStock(product);
    }
  } catch (notifyError) {
    console.error('[ORDER_FULFILLMENT] low_stock notification failed:', notifyError);
  }

  recalculateAfterPayment();

  return order;
}
