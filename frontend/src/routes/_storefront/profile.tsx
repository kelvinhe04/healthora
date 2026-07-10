import { createFileRoute } from '@tanstack/react-router';
import { Profile } from '../../pages/Profile';
import { useStorefrontNav } from '../../hooks/useStorefrontNav';

export const Route = createFileRoute('/_storefront/profile')({
  component: ProfileRoute,
});

function ProfileRoute() {
  const { nav } = useStorefrontNav();
  return <Profile onBack={() => nav('catalog')} />;
}
