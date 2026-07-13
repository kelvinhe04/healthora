import { Hono } from 'hono';
import { z } from 'zod';
import { stripe } from '../lib/stripe';
import { Order } from '../db/models/Order';
import { Product } from '../db/models/Product';
import { normalizeOrder } from '../lib/orderStatus';
import { sendOrderConfirmationEmail } from '../lib/email';
import { recalculateBestsellers, recalculatePurchasesLastMonth } from '../lib/bestsellers';
import { cartItemSchema, emailField, moneyFromInput, optionalTextField, orderAddressSchema, shippingMethodSchema, textField } from '../lib/validation';
import { buildPaidLineItem } from '../lib/productVariants';
import { decrementStock, validateCartStock } from '../lib/inventory';
import { notifyAdmins, notifyUser } from '../lib/realtime';
import { scanAndNotifyLowStock } from '../lib/lowStock';
import { confirmReturnRefund } from '../lib/returns';
import { recordCouponRedemption } from '../lib/promotions';

type CheckoutAddress = {
  name: string;
  phone: string;
  address: string;
  city: string;
  postal: string;
};

type CheckoutCartItem = {
  productId: string;
  qty: number;
  variantId?: string;
  isSample?: boolean;
};

const webhookCartItemSchema = cartItemSchema.extend({
  isSample: z.coerce.boolean().optional(),
});

const webhookMetadataSchema = z.object({
  customerId: textField(180),
  customerName: optionalTextField(160),
  customerEmail: emailField().optional(),
  cartItems: textField(20000),
  address: textField(5000),
  discountCode: optionalTextField(80),
  discountAmount: moneyFromInput().default(0),
  tax: moneyFromInput().default(0),
  shipping: moneyFromInput().default(0),
  shippingMethod: shippingMethodSchema.optional(),
  shippingLabel: optionalTextField(160),
  shippingEta: optionalTextField(80),
});

function parseJsonMetadata<T>(value: string, schema: z.ZodType<T>) {
  try {
    return schema.safeParse(JSON.parse(value));
  } catch {
    return schema.safeParse(null);
  }
}

export const webhooksRouter = new Hono().post('/stripe', async (c) => {
  console.log('[WEBHOOK] Received request');
  const sig = c.req.header('stripe-signature');
  if (!sig) {
    console.log('[WEBHOOK] Missing signature header');
    return c.json({ error: 'Missing signature' }, 400);
  }

  let event;
  try {
    const rawBody = await c.req.text();
    // constructEvent (sync) picks a SubtleCrypto-based provider under Bun, which throws
    // "SubtleCryptoProvider cannot be used in a synchronous context" on every call - the async
    // variant is required here, not a style preference. Without this every real Stripe webhook
    // was rejected with 400 "Invalid signature" and never reached order creation.
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('[WEBHOOK] Signature verification failed:', err);
    return c.json({ error: 'Invalid signature' }, 400);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('[WEBHOOK] checkout.session.completed received for session:', session.id);
    const existingOrder = await Order.findOne({ stripeSessionId: session.id }).lean();
    if (!existingOrder) {
      try {
        const parsedMetadata = webhookMetadataSchema.safeParse(session.metadata || {});
        if (!parsedMetadata.success) {
          return c.json({ error: 'Invalid checkout metadata', details: parsedMetadata.error.issues }, 400);
        }

        const metadata = parsedMetadata.data;
        const parsedCartItems = parseJsonMetadata(metadata.cartItems, z.array(webhookCartItemSchema).min(1).max(100));
        if (!parsedCartItems.success) {
          return c.json({ error: 'Invalid checkout cart metadata', details: parsedCartItems.error.issues }, 400);
        }

        const parsedAddress = parseJsonMetadata(metadata.address, orderAddressSchema);
        if (!parsedAddress.success) {
          return c.json({ error: 'Invalid checkout address metadata', details: parsedAddress.error.issues }, 400);
        }

        const cartItems = parsedCartItems.data as CheckoutCartItem[];
        const parsedAddressData = parsedAddress.data as { name: string; phone: string; address?: string; city?: string; postal?: string };
        const address: CheckoutAddress = {
          name: parsedAddressData.name,
          phone: parsedAddressData.phone,
          address: parsedAddressData.address || '',
          city: parsedAddressData.city || '',
          postal: parsedAddressData.postal || '',
        };
        const sessionEmail = typeof session.customer_email === 'string' ? session.customer_email : undefined;
        const customerEmail = metadata.customerEmail || sessionEmail;
        console.log('[WEBHOOK] Customer email:', customerEmail);

        const productIds = [...new Set(cartItems.map((item) => item.productId))];
        const products = await Product.find({ id: { $in: productIds }, active: true }).lean();
        if (products.length !== productIds.length) {
          console.error('[WEBHOOK] Missing products while creating paid order for session', session.id);
        } else {
          console.log('[WEBHOOK] cartItems from metadata:', JSON.stringify(cartItems));
          try {
            validateCartStock(products, cartItems);
          } catch (error) {
            console.error('[WEBHOOK] Stock validation failed:', error);
            return c.json({ error: 'Stock insuficiente' }, 400);
          }
          const lineItems = cartItems.map((item) => {
            const product = products.find((entry) => entry.id === item.productId);
            if (!product) throw new Error(`Product not found for ${item.productId}`);
            return buildPaidLineItem(product, item);
          });
          console.log('[WEBHOOK] lineItems prices:', lineItems.map((i) => `${i.productName}: $${i.price} isSample=${i.isSample}`));

          const subtotal = lineItems.reduce((sum, item) => sum + item.price * item.qty, 0);
          console.log('[WEBHOOK] subtotal:', subtotal);
          const discountCode = metadata.discountCode || undefined;
          const discountAmount = metadata.discountAmount;
          const tax = metadata.tax;
          const shipping = metadata.shipping;
          const total = Math.round((subtotal - discountAmount + tax + shipping) * 100) / 100;

          const order = await Order.create({
            customerId: metadata.customerId,
            customerName: metadata.customerName,
            customerEmail: customerEmail,
            items: lineItems,
            subtotal,
            discountCode,
            discountAmount,
            tax,
            shipping,
            shippingMethod: metadata.shippingMethod,
            shippingLabel: metadata.shippingLabel,
            shippingEta: metadata.shippingEta,
            total,
            paymentStatus: 'paid',
            fulfillmentStatus: 'unfulfilled',
            status: 'paid',
            stripeSessionId: session.id,
            stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
            address,
          });

          console.log('[WEBHOOK] Order created:', order._id, 'Email:', customerEmail);

          if (discountCode) {
            await recordCouponRedemption(discountCode);
          }

          if (customerEmail) {
            try {
              await sendOrderConfirmationEmail({
                customerName: metadata.customerName || 'cliente',
                customerEmail: customerEmail,
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
              });
              console.log('[WEBHOOK] Email sent successfully');
            } catch (emailError) {
              console.error('[WEBHOOK] Email error:', emailError);
            }
          }

          for (const item of lineItems) {
            if (item.isSample) continue;
            const ok = await decrementStock(item.productId, item.qty, item.variantId);
            if (!ok) {
              console.error('[WEBHOOK] Stock decrement failed for', item.productId, item.variantId);
            }
          }

          // Real-time notifications (HU-061). Best-effort: a notification failure must never break
          // the paid-order flow, so each push is guarded independently.
          try {
            await notifyUser(metadata.customerId, {
              type: 'order_paid',
              title: 'Pago confirmado',
              body: `Recibimos tu pago de $${total.toFixed(2)}. Tu pedido está en preparación.`,
              link: '/orders',
              data: { orderId: order._id.toString(), total },
            });
            console.log('[WEBHOOK] order_paid notification created for', metadata.customerId);
          } catch (notifyError) {
            console.error('[WEBHOOK] order_paid notification failed:', notifyError);
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
            console.error('[WEBHOOK] new_order admin notification failed:', notifyError);
          }

          try {
            const soldProductIds = [...new Set(lineItems.filter((i) => !i.isSample).map((i) => i.productId))];
            const soldProducts = await Product.find({ id: { $in: soldProductIds } }).lean();
            for (const product of soldProducts) {
              await scanAndNotifyLowStock(product);
            }
          } catch (notifyError) {
            console.error('[WEBHOOK] low_stock notification failed:', notifyError);
          }
        }
      } catch (error) {
        console.error('[WEBHOOK] Failed to create paid order:', error);
      }
    } else {
      console.log('[WEBHOOK] Order already exists for session:', session.id);
      const normalizedExisting = normalizeOrder(existingOrder);
      if (normalizedExisting.paymentStatus !== 'paid') {
        await Order.findOneAndUpdate(
          { stripeSessionId: session.id },
          {
            paymentStatus: 'paid',
            fulfillmentStatus: normalizedExisting.fulfillmentStatus,
            status: normalizedExisting.fulfillmentStatus === 'unfulfilled' ? 'paid' : normalizedExisting.status,
            stripePaymentIntentId: session.payment_intent,
          }
        );

        // An order that existed as pending and just flipped to paid still deserves the customer
        // notification (HU-061). Best-effort. The !existingOrder branch above handles the common
        // path where the webhook creates the paid order outright.
        if (existingOrder.customerId) {
          try {
            await notifyUser(existingOrder.customerId, {
              type: 'order_paid',
              title: 'Pago confirmado',
              body: `Recibimos tu pago de $${(existingOrder.total ?? 0).toFixed(2)}. Tu pedido está en preparación.`,
              link: '/orders',
              data: { orderId: existingOrder._id.toString(), total: existingOrder.total ?? 0 },
            });
          } catch (notifyError) {
            console.error('[WEBHOOK] order_paid (existing) notification failed:', notifyError);
          }
        }
      }
    }
  } else if (event.type === 'refund.updated') {
    // Source of truth for a return's refund (see lib/returns.ts#confirmReturnRefund) - mirrors
    // checkout.session.completed being the source of truth for payment, rather than trusting the
    // synchronous stripe.refunds.create() response.
    const refund = event.data.object;
    console.log('[WEBHOOK] refund.updated received:', refund.id, refund.status);
    try {
      await confirmReturnRefund(refund.id, refund.status ?? '');
    } catch (error) {
      console.error('[WEBHOOK] Failed to process refund.updated:', error);
    }
  }

  // Recalculate bestsellers after any payment event
  if (process.env.NODE_ENV !== 'test') {
    recalculateBestsellers().catch((e) => console.error('[bestsellers] recalc error:', e));
    recalculatePurchasesLastMonth().catch((e) => console.error('[purchases-last-month] recalc error:', e));
  }

  console.log('[WEBHOOK] Request processed');
  return c.json({ received: true });
});
