import Stripe from 'stripe';

// @ts-expect-error newer API version
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
