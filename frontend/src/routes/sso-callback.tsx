import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { SSOCallbackPage } from '../components/SSOCallback';

export const Route = createFileRoute('/sso-callback')({
  component: SSOCallbackRoute,
});

function SSOCallbackRoute() {
  const navigate = useNavigate();
  return <SSOCallbackPage onSuccess={() => navigate({ to: '/' })} />;
}
