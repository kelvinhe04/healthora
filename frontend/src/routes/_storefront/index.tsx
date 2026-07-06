import { createFileRoute } from '@tanstack/react-router';
import { Landing } from '../../pages/Landing';
import { useStorefrontNav } from '../../hooks/useStorefrontNav';

export const Route = createFileRoute('/_storefront/')({
  component: LandingRoute,
});

function LandingRoute() {
  const { nav, openProduct, onAdd } = useStorefrontNav();
  return <Landing onNav={nav} onOpenProduct={openProduct} onAdd={onAdd} />;
}
