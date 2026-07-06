import { createFileRoute } from '@tanstack/react-router';
import { Success } from '../../pages/Success';
import { useStorefrontNav } from '../../hooks/useStorefrontNav';

export const Route = createFileRoute('/_storefront/success')({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === 'string' ? search.session_id : undefined,
  }),
  component: SuccessRoute,
});

function SuccessRoute() {
  const { session_id } = Route.useSearch();
  const { nav } = useStorefrontNav();
  return <Success sessionId={session_id || ''} onBack={() => nav('landing')} />;
}
