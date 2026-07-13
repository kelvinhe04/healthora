import { stripe } from './stripe';
import { User } from '../db/models/User';

/**
 * Every logged-in customer gets at most one Stripe Customer, created lazily the first time it's
 * needed (subscribing to auto-reposición, or checking out) rather than at sign-up. `findOneAndUpdate`
 * with `upsert: true` (not `updateOne`) matters here: the test-mode Clerk auth bypass sets the
 * request context's user without ever creating a Mongo `User` document, so a plain `updateOne`
 * would silently match nothing and the id would never persist - every subsequent call would create
 * a fresh Stripe customer instead of reusing the saved one.
 */
export async function getOrCreateStripeCustomer(
  clerkId: string,
  email?: string,
  name?: string,
): Promise<string> {
  const existing = await User.findOne({ clerkId }).select('stripeCustomerId').lean();
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: email || undefined,
    name: name || undefined,
    metadata: { clerkId },
  });

  await User.findOneAndUpdate(
    { clerkId },
    { $set: { stripeCustomerId: customer.id } },
    { upsert: true },
  );

  return customer.id;
}
