import { createFileRoute } from '@tanstack/react-router';
import { Orders } from '../../pages/Orders';
import { useStorefrontNav } from '../../hooks/useStorefrontNav';

export const Route = createFileRoute('/_storefront/orders')({
  component: OrdersRoute,
});

function OrdersRoute() {
  const { nav } = useStorefrontNav();
  return <Orders onBack={() => nav('catalog')} />;
}
