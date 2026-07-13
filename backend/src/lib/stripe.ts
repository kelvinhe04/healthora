import Stripe from 'stripe';

type TestStripeSession = {
  id: string;
  url: string;
  payment_status?: string;
  status?: string;
  mode?: string;
  metadata?: Record<string, string>;
  customer_email?: string;
  customer?: string;
  payment_intent?: string;
  subscription?: string;
};

let testSession: TestStripeSession | null = null;
let testCustomerCounter = 0;
let testSubscriptionCounter = 0;
const testSubscriptions = new Map<string, { id: string; status: string; pause_collection: { behavior: string } | null; current_period_end: number }>();

export function getLastTestStripeSession() {
  return testSession;
}

/** Test-only seam so integration tests can assert on the subscription state after a pause/resume/
 * cancel call, and reset between tests (module-level state outlives `dropDatabase()`). */
export function getTestSubscription(id: string) {
  return testSubscriptions.get(id);
}

export function resetTestStripeState() {
  testSession = null;
  testSubscriptions.clear();
}

// @ts-expect-error newer API version
export const stripe = process.env.NODE_ENV === 'test'
  ? {
      checkout: {
        sessions: {
          create: async (payload: {
            mode?: string;
            metadata?: Record<string, string>;
            customer_email?: string;
            customer?: string;
          }) => {
            let subscription: string | undefined;
            if (payload.mode === 'subscription') {
              testSubscriptionCounter += 1;
              subscription = `sub_test_${testSubscriptionCounter}`;
              testSubscriptions.set(subscription, {
                id: subscription,
                status: 'active',
                pause_collection: null,
                current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              });
            }
            testSession = {
              id: 'cs_test_healthora',
              url: 'https://checkout.stripe.test/session',
              payment_status: payload.mode === 'subscription' ? undefined : 'paid',
              status: 'complete',
              mode: payload.mode,
              metadata: payload.metadata,
              customer_email: payload.customer_email,
              customer: payload.customer,
              payment_intent: payload.mode === 'subscription' ? undefined : 'pi_test_healthora',
              subscription,
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
      customers: {
        create: async (payload: { email?: string; name?: string }) => {
          testCustomerCounter += 1;
          return { id: `cus_test_${testCustomerCounter}`, email: payload.email, name: payload.name };
        },
      },
      subscriptions: {
        retrieve: async (id: string) => {
          const sub = testSubscriptions.get(id);
          if (!sub) throw Object.assign(new Error('No such subscription'), { statusCode: 404 });
          return sub;
        },
        update: async (id: string, payload: { pause_collection?: { behavior: string } | null }) => {
          const sub = testSubscriptions.get(id);
          if (!sub) throw Object.assign(new Error('No such subscription'), { statusCode: 404 });
          sub.pause_collection = payload.pause_collection ?? null;
          testSubscriptions.set(id, sub);
          return sub;
        },
        cancel: async (id: string) => {
          const sub = testSubscriptions.get(id);
          if (!sub) throw Object.assign(new Error('No such subscription'), { statusCode: 404 });
          sub.status = 'canceled';
          testSubscriptions.set(id, sub);
          return sub;
        },
      },
      webhooks: {
        constructEvent: (rawBody: string) => JSON.parse(rawBody),
        constructEventAsync: async (rawBody: string) => JSON.parse(rawBody),
      },
    }
  : new Stripe(process.env.STRIPE_SECRET_KEY!);
