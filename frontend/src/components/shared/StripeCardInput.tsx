import { CardElement } from '@stripe/react-stripe-js';

/**
 * The raw Stripe card input, shared by Profile's "add card" form and Checkout's "new card"
 * option. `disableLink: true` matters: without it, Stripe Link's own inline autofill row can take
 * over this element and block manual typing once Link recognizes the browser/email (HU-059).
 * Callers get the underlying PaymentMethod-creation data via `useElements().getElement(CardElement)`.
 */
export function StripeCardInput() {
  return (
    <div style={{ border: '1px solid var(--ink-10)', borderRadius: 12, padding: '14px 16px', background: 'var(--cream)' }}>
      <CardElement options={{ disableLink: true, style: { base: { fontSize: '14px', color: 'var(--ink)' } } }} />
    </div>
  );
}
