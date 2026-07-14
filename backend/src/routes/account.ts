import { Hono } from 'hono';
import { z } from 'zod';
import { clerkAuth } from '../middleware/clerkAuth';
import type { AppEnv } from '../types/hono';
import { User } from '../db/models/User';
import { parseJson, savedAddressSchema } from '../lib/validation';
import { stripe } from '../lib/stripe';
import { getOrCreateStripeCustomer } from '../lib/stripeCustomer';

type StripePaymentMethod = {
  id: string;
  customer?: string | null;
  card?: { brand: string; last4: string; exp_month: number; exp_year: number };
};

type StripeCustomerWithDefaultPm = {
  invoice_settings?: { default_payment_method?: string | { id: string } | null };
};

const addressesPayloadSchema = z.object({
  addresses: z.array(savedAddressSchema).max(20).default([]),
});

type Address = z.infer<typeof savedAddressSchema>;

function normalizeAddresses(addresses: Address[]) {
  const sanitized = addresses
    .map((address) => ({
      label: address.label?.trim() || '',
      name: address.name.trim(),
      phone: address.phone.trim(),
      address: address.address.trim(),
      city: address.city.trim(),
      postal: address.postal.trim(),
      isDefault: Boolean(address.isDefault),
    }))
    .filter((address) => address.name && address.phone && address.address && address.city && address.postal);

  const defaultIndex = sanitized.findIndex((address) => address.isDefault);
  const nextAddresses = sanitized.map((address, index) => ({ ...address, isDefault: index === defaultIndex }));

  if (nextAddresses.length > 0 && defaultIndex === -1) {
    nextAddresses[0].isDefault = true;
  }

  return nextAddresses;
}

export const accountRouter = new Hono<AppEnv>()
  .use('*', clerkAuth)
  .get('/addresses', async (c) => {
    const currentUser = await User.findOne({ clerkId: c.get('user').clerkId }).select('addresses').lean();
    return c.json(currentUser?.addresses || []);
  })
  .put('/addresses', async (c) => {
    const parsed = await parseJson(c, addressesPayloadSchema);
    if (!parsed.success) return parsed.response;

    const addresses = normalizeAddresses(parsed.data.addresses);

    const updatedUser = await User.findOneAndUpdate(
      { clerkId: c.get('user').clerkId },
      { $set: { addresses } },
      { returnDocument: 'after' }
    ).select('addresses').lean();

    if (!updatedUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(updatedUser.addresses || []);
  })
  .get('/payment-methods', async (c) => {
    const currentUser = await User.findOne({ clerkId: c.get('user').clerkId })
      .select('stripeCustomerId')
      .lean();
    if (!currentUser?.stripeCustomerId) return c.json([]);

    const [methods, customer] = await Promise.all([
      stripe.paymentMethods.list({ customer: currentUser.stripeCustomerId, type: 'card' }),
      stripe.customers.retrieve(currentUser.stripeCustomerId) as Promise<StripeCustomerWithDefaultPm>,
    ]);
    const defaultPmId = typeof customer.invoice_settings?.default_payment_method === 'string'
      ? customer.invoice_settings.default_payment_method
      : customer.invoice_settings?.default_payment_method?.id;

    return c.json(
      (methods.data as StripePaymentMethod[]).map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
        isDefault: pm.id === defaultPmId,
      })),
    );
  })
  .post('/payment-methods/setup-intent', async (c) => {
    const user = c.get('user');
    const customerId = await getOrCreateStripeCustomer(user.clerkId, user.email, user.name);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });

    return c.json({ clientSecret: setupIntent.client_secret });
  })
  .delete('/payment-methods/:id', async (c) => {
    const id = c.req.param('id');
    const currentUser = await User.findOne({ clerkId: c.get('user').clerkId })
      .select('stripeCustomerId')
      .lean();
    if (!currentUser?.stripeCustomerId) return c.json({ error: 'No tienes métodos de pago guardados' }, 404);

    let paymentMethod: StripePaymentMethod;
    try {
      paymentMethod = await stripe.paymentMethods.retrieve(id);
    } catch {
      return c.json({ error: 'Método de pago no encontrado' }, 404);
    }

    // Confirms the payment method actually belongs to this customer before detaching it - without
    // this check any authenticated user could detach anyone else's saved card just by guessing/
    // reusing a Stripe payment method id (IDOR).
    if (paymentMethod.customer !== currentUser.stripeCustomerId) {
      return c.json({ error: 'Método de pago no encontrado' }, 404);
    }

    await stripe.paymentMethods.detach(id);
    return c.json({ ok: true });
  })
  .patch('/payment-methods/:id/default', async (c) => {
    const id = c.req.param('id');
    const currentUser = await User.findOne({ clerkId: c.get('user').clerkId })
      .select('stripeCustomerId')
      .lean();
    if (!currentUser?.stripeCustomerId) return c.json({ error: 'No tienes métodos de pago guardados' }, 404);

    let paymentMethod: StripePaymentMethod;
    try {
      paymentMethod = await stripe.paymentMethods.retrieve(id);
    } catch {
      return c.json({ error: 'Método de pago no encontrado' }, 404);
    }

    // Same ownership check as DELETE (IDOR guard) - without it any authenticated user could set
    // someone else's card as their own "default" by guessing/reusing a payment method id.
    if (paymentMethod.customer !== currentUser.stripeCustomerId) {
      return c.json({ error: 'Método de pago no encontrado' }, 404);
    }

    await stripe.customers.update(currentUser.stripeCustomerId, {
      invoice_settings: { default_payment_method: id },
    });

    return c.json({ ok: true });
  });
