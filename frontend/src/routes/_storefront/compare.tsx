import { createFileRoute } from '@tanstack/react-router';
import { Compare } from '../../pages/Compare';
import { useStorefrontNav } from '../../hooks/useStorefrontNav';

export const Route = createFileRoute('/_storefront/compare')({
  component: CompareRoute,
});

function CompareRoute() {
  const { nav, openProduct, onAdd } = useStorefrontNav();
  return (
    <Compare
      onBack={() => nav('catalog')}
      onOpenProduct={openProduct}
      onAdd={onAdd}
    />
  );
}
