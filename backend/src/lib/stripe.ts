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
let testCustomerCounter = 0;
const testPaymentMethodsByCustomer = new Map<string, { id: string; customer: string; card: { brand: string; last4: string; exp_month: number; exp_year: number } }[]>();

export function getLastTestStripeSession() {
  return testSession;
}

// @ts-expect-error newer API version
export const stripe = process.env.NODE_ENV === 'test'
  ? {
      checkout: {
        sessions: {
          create: async (payload: { metadata?: Record<string, string>; customer_email?: string; customer?: string }) => {
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
      customers: {
        create: async (payload: { email?: string; name?: string }) => {
          testCustomerCounter += 1;
          return { id: `cus_test_${testCustomerCounter}`, email: payload.email, name: payload.name };
        },
      },
      setupIntents: {
        create: async (payload: { customer: string }) => ({
          id: 'seti_test_healthora',
          client_secret: 'seti_test_healthora_secret',
          status: 'requires_payment_method',
          customer: payload.customer,
        }),
      },
      paymentMethods: {
        list: async (payload: { customer: string }) => ({
          data: testPaymentMethodsByCustomer.get(payload.customer) ?? [],
        }),
        retrieve: async (id: string) => {
          for (const methods of testPaymentMethodsByCustomer.values()) {
            const found = methods.find((m) => m.id === id);
            if (found) return found;
          }
          throw Object.assign(new Error('No such payment method'), { statusCode: 404 });
        },
        detach: async (id: string) => {
          for (const [customer, methods] of testPaymentMethodsByCustomer.entries()) {
            const index = methods.findIndex((m) => m.id === id);
            if (index !== -1) {
              const [removed] = methods.splice(index, 1);
              testPaymentMethodsByCustomer.set(customer, methods);
              return removed;
            }
          }
          throw Object.assign(new Error('No such payment method'), { statusCode: 404 });
        },
      },
      webhooks: {
        constructEvent: (rawBody: string) => JSON.parse(rawBody),
        constructEventAsync: async (rawBody: string) => JSON.parse(rawBody),
      },
    }
  : new Stripe(process.env.STRIPE_SECRET_KEY!);

/** Test-only seam: lets integration tests seed a saved card onto a test customer without a real
 * Stripe SetupIntent confirmation round-trip (there's no browser/Stripe.js in a bun:test run). */
export function seedTestPaymentMethod(customer: string, card: { id: string; brand: string; last4: string; expMonth: number; expYear: number }) {
  const methods = testPaymentMethodsByCustomer.get(customer) ?? [];
  methods.push({ id: card.id, customer, card: { brand: card.brand, last4: card.last4, exp_month: card.expMonth, exp_year: card.expYear } });
  testPaymentMethodsByCustomer.set(customer, methods);
}

/** Call from a test's `beforeEach` - this module-level state outlives `dropDatabase()` (it isn't
 * stored in Mongo), so reusing a fixed payment method id like `pm_visa_test` across tests without
 * this would let a stale entry from an earlier test shadow the current test's fresh one. */
export function resetTestStripeState() {
  testSession = null;
  testPaymentMethodsByCustomer.clear();
}
