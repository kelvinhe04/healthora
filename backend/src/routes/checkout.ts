import Elysia, { t } from 'elysia';
import { clerkAuth } from '../middleware/clerkAuth';
import { Product } from '../db/models/Product';
import { Order } from '../db/models/Order';
import { stripe } from '../lib/stripe';

export const checkoutRouter = new Elysia({ prefix: '/checkout' })
  .use(clerkAuth)
  .post('/session', async ({ body, user, set, request }) => {
    const { items, address } = body;

    // Validate & fetch products from DB (never trust client prices)
    const productIds = items.map((i) => i.productId);
    const products = await Product.find({ id: { $in: productIds }, active: true }).lean();
    if (products.length !== items.length) {
      set.status = 400; return { error: 'One or more products not found' };
    }

    const lineItems = items.map((item) => {
      const p = products.find((p) => p.id === item.productId)!;
      if (p.stock < item.qty) throw new Error(`Stock insuficiente para ${p.name}`);
      return { productId: p.id, productName: p.name, qty: item.qty, price: p.price };
    });

    const subtotal = lineItems.reduce((s, i) => s + i.price * i.qty, 0);
    const tax = Math.round(subtotal * 0.07 * 100) / 100;
    const shipping = subtotal >= 50 ? 0 : 6.90;
    const total = Math.round((subtotal + tax + shipping) * 100) / 100;

    const order = await Order.create({
      customerId: user.clerkId,
      customerName: user.name,
      customerEmail: user.email,
      items: lineItems,
      subtotal, tax, shipping, total,
      status: 'pending_payment',
      address,
    });

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: user.email,
        line_items: lineItems.map((i) => ({
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(i.price * 100),
            product_data: { name: i.productName },
          },
          quantity: i.qty,
        })),
        metadata: { orderId: order._id.toString() },
        success_url: `${request.headers.get('origin')}/?view=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${request.headers.get('origin')}/?view=checkout`,
      });

      await Order.findByIdAndUpdate(order._id, { stripeSessionId: session.id });

      // Reserve stock
      for (const item of lineItems) {
        await Product.findOneAndUpdate({ id: item.productId }, { $inc: { stock: -item.qty } });
      }

      return { url: session.url };
    } catch (stripeErr: unknown) {
      const errMsg = stripeErr instanceof Error ? stripeErr.message : 'Stripe error';
      console.error('[CHECKOUT] Stripe session creation failed:', errMsg);
      await Order.findByIdAndDelete(order._id);
      set.status = 502;
      return { error: 'Payment service unavailable', details: errMsg };
    }
  }, {
    body: t.Object({
      items: t.Array(t.Object({ productId: t.String(), qty: t.Number() })),
      address: t.Object({
        name: t.String(), phone: t.String(), address: t.String(), city: t.String(), postal: t.String(),
      }),
    }),
  });
