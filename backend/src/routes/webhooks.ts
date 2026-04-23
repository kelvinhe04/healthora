import Elysia from 'elysia';
import { stripe } from '../lib/stripe';
import { Order } from '../db/models/Order';
import { Product } from '../db/models/Product';

export const webhooksRouter = new Elysia({ prefix: '/webhooks' })
  .post('/stripe', async ({ request, set }) => {
    const sig = request.headers.get('stripe-signature');
    if (!sig) { set.status = 400; return { error: 'Missing signature' }; }

    let event;
    try {
      const rawBody = await request.text();
      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch {
      set.status = 400; return { error: 'Invalid signature' };
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await Order.findOneAndUpdate(
        { stripeSessionId: session.id },
        { status: 'paid', stripePaymentIntentId: session.payment_intent }
      );
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object;
      const order = await Order.findOneAndUpdate(
        { stripeSessionId: session.id, status: 'pending_payment' },
        { status: 'cancelled' },
        { new: false }
      ).lean();
      if (order) {
        for (const item of (order as { items?: { productId: string; qty: number }[] }).items || []) {
          await Product.findOneAndUpdate({ id: item.productId }, { $inc: { stock: item.qty } });
        }
      }
    }

    return { received: true };
  });
