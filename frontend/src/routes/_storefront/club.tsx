import { createFileRoute } from '@tanstack/react-router';
import { Club } from '../../pages/Club';
import { useStorefrontNav } from '../../hooks/useStorefrontNav';

export const Route = createFileRoute('/_storefront/club')({
  component: ClubRoute,
});

function ClubRoute() {
  const { nav } = useStorefrontNav();
  return <Club onNav={nav} />;
}
