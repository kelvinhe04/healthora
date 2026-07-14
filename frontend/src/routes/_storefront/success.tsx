import { createFileRoute } from '@tanstack/react-router';
import { Success } from '../../pages/Success';
import { useStorefrontNav } from '../../hooks/useStorefrontNav';

export const Route = createFileRoute('/_storefront/success')({
  validateSearch: (search: Record<string, unknown>): { session_id?: string; payment_intent?: string } => ({
    session_id: typeof search.session_id === 'string' ? search.session_id : undefined,
    payment_intent: typeof search.payment_intent === 'string' ? search.payment_intent : undefined,
  }),
  component: SuccessRoute,
});

function SuccessRoute() {
  const { session_id, payment_intent } = Route.useSearch();
  const { nav } = useStorefrontNav();
  return <Success sessionId={session_id || ''} paymentIntentId={payment_intent || ''} onBack={() => nav('landing')} />;
}
