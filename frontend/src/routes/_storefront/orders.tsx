import { createFileRoute } from '@tanstack/react-router';
import { Orders } from '../../pages/Orders';
import { useStorefrontNav } from '../../hooks/useStorefrontNav';

export const Route = createFileRoute('/_storefront/orders')({
  validateSearch: (search: Record<string, unknown>): { orderId?: string } => ({
    orderId: typeof search.orderId === 'string' ? search.orderId : undefined,
  }),
  component: OrdersRoute,
});

function OrdersRoute() {
  const { orderId } = Route.useSearch();
  const { nav } = useStorefrontNav();
  return <Orders onBack={() => nav('catalog')} initialOrderId={orderId} />;
}
