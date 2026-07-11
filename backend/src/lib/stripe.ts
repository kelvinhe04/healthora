import Stripe from 'stripe';

type TestStripeSession = {
  id: string;
  url: string;
  payment_status?: string;
  status?: string;
  metadata?: Record<string, string>;
  customer_email?: string;
  payment_intent?: string;
};

let testSession: TestStripeSession | null = null;

export function getLastTestStripeSession() {
  return testSession;
}

// @ts-expect-error newer API version
export const stripe = process.env.NODE_ENV === 'test'
  ? {
      checkout: {
        sessions: {
          create: async (payload: { metadata?: Record<string, string>; customer_email?: string }) => {
            testSession = {
              id: 'cs_test_healthora',
              url: 'https://checkout.stripe.test/session',
              payment_status: 'paid',
              status: 'complete',
              metadata: payload.metadata,
              customer_email: payload.customer_email,
              payment_intent: 'pi_test_healthora',
            };
            return testSession;
          },
          retrieve: async () => testSession,
        },
      },
      coupons: {
        create: async () => ({ id: 'coupon_test_healthora' }),
      },
      refunds: {
        create: async (payload: { payment_intent?: string; amount?: number }) => ({
          id: 'refund_test_healthora',
          payment_intent: payload.payment_intent,
          amount: payload.amount,
          status: 'succeeded',
        }),
        retrieve: async (id: string) => ({ id, status: 'succeeded' }),
      },
      webhooks: {
        constructEvent: (rawBody: string) => JSON.parse(rawBody),
        constructEventAsync: async (rawBody: string) => JSON.parse(rawBody),
      },
    }
  : new Stripe(process.env.STRIPE_SECRET_KEY!);
