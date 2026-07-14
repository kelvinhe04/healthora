import { Hono } from 'hono';
import { stripe } from '../lib/stripe';
import { Order } from '../db/models/Order';
import { normalizeOrder } from '../lib/orderStatus';
import { recalculateAfterPayment } from '../lib/bestsellers';
import { createPaidOrder, orderMetadataSchema } from '../lib/orderFulfillment';
import { notifyUser } from '../lib/realtime';
import { confirmReturnRefund } from '../lib/returns';

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
        const parsedMetadata = orderMetadataSchema.safeParse(session.metadata || {});
        if (!parsedMetadata.success) {
          throw new Error(`Invalid checkout metadata: ${JSON.stringify(parsedMetadata.error.issues)}`);
        }

        const sessionEmail = typeof session.customer_email === 'string' ? session.customer_email : undefined;
        const order = await createPaidOrder({
          metadata: parsedMetadata.data,
          stripeSessionId: session.id,
          stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
          customerEmailFallback: sessionEmail,
        });
        console.log('[WEBHOOK] Order created:', order._id);
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
  } else if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    // PaymentIntents created behind a Checkout Session also fire this event, but that path is
    // already handled above by checkout.session.completed - only PaymentIntents we create
    // directly (the embedded checkout, source: 'elements') should create an order here, or every
    // hosted-Checkout payment would create a duplicate order.
    if (paymentIntent.metadata?.source !== 'elements') {
      console.log('[WEBHOOK] Ignoring payment_intent.succeeded without source=elements:', paymentIntent.id);
    } else {
      console.log('[WEBHOOK] payment_intent.succeeded received for intent:', paymentIntent.id);
      const existingOrder = await Order.findOne({ stripePaymentIntentId: paymentIntent.id }).lean();
      if (!existingOrder) {
        try {
          const parsedMetadata = orderMetadataSchema.safeParse(paymentIntent.metadata || {});
          if (!parsedMetadata.success) {
            throw new Error(`Invalid payment intent metadata: ${JSON.stringify(parsedMetadata.error.issues)}`);
          }

          const order = await createPaidOrder({
            metadata: parsedMetadata.data,
            stripePaymentIntentId: paymentIntent.id,
          });
          console.log('[WEBHOOK] Order created:', order._id);
        } catch (error) {
          console.error('[WEBHOOK] Failed to create paid order from payment_intent:', error);
        }
      } else {
        console.log('[WEBHOOK] Order already exists for payment_intent:', paymentIntent.id);
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

  // Recalculate bestsellers and purchases-last-month after any payment event
  recalculateAfterPayment();

  console.log('[WEBHOOK] Request processed');
  return c.json({ received: true });
});
