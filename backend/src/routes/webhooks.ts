import { Hono } from 'hono';
import { stripe } from '../lib/stripe';
import { Order } from '../db/models/Order';
import { Product } from '../db/models/Product';
import { normalizeOrder } from '../lib/orderStatus';
import { sendOrderConfirmationEmail } from '../lib/email';
import { recalculateBestsellers } from '../lib/bestsellers';

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
};

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
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
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
        const metadata = session.metadata || {};
        const cartItems = JSON.parse(metadata.cartItems || '[]') as CheckoutCartItem[];
        const address = JSON.parse(metadata.address || '{}') as CheckoutAddress;

        const customerEmail = metadata.customerEmail || session.customer_email;
        console.log('[WEBHOOK] Customer email:', customerEmail);

        const productIds = cartItems.map((item) => item.productId);
        const products = await Product.find({ id: { $in: productIds }, active: true }).lean();
        if (products.length !== cartItems.length) {
          console.error('[WEBHOOK] Missing products while creating paid order for session', session.id);
        } else {
          const lineItems = cartItems.map((item) => {
            const product = products.find((entry) => entry.id === item.productId);
            if (!product) throw new Error(`Product not found for ${item.productId}`);
            if (product.stock < item.qty) throw new Error(`Insufficient stock for ${product.name}`);
            const primaryImage = product.images?.find((img) => img.isPrimary)?.url || product.images?.[0]?.url || product.imageUrl || '';
            return { productId: product.id, productName: product.name, qty: item.qty, price: product.price, imageUrl: primaryImage, category: product.category };
          });

          const subtotal = lineItems.reduce((sum, item) => sum + item.price * item.qty, 0);
          const discountCode = metadata.discountCode || undefined;
          const discountAmount = Number(metadata.discountAmount || 0);
          const tax = Number(metadata.tax || 0);
          const shipping = Number(metadata.shipping || 0);
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
            total,
            paymentStatus: 'paid',
            fulfillmentStatus: 'unfulfilled',
            status: 'paid',
            stripeSessionId: session.id,
            stripePaymentIntentId: session.payment_intent,
            address,
          });

          console.log('[WEBHOOK] Order created:', order._id, 'Email:', customerEmail);

          try {
            await sendOrderConfirmationEmail({
              customerName: metadata.customerName,
              customerEmail: customerEmail,
              orderId: order._id.toString(),
              items: lineItems,
              subtotal,
              discountCode,
              discountAmount,
              tax,
              shipping,
              total,
              address,
              createdAt: order.createdAt,
            });
            console.log('[WEBHOOK] Email sent successfully');
          } catch (emailError) {
            console.error('[WEBHOOK] Email error:', emailError);
          }

          for (const item of lineItems) {
            await Product.findOneAndUpdate({ id: item.productId }, { $inc: { stock: -item.qty } });
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
      }
    }
  }

  // Recalculate bestsellers after any payment event
  recalculateBestsellers().catch((e) => console.error('[bestsellers] recalc error:', e));

  console.log('[WEBHOOK] Request processed');
  return c.json({ received: true });
});
