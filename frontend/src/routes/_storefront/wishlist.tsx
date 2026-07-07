import { createFileRoute } from '@tanstack/react-router';
import { WishlistPage } from '../../pages/Wishlist';
import { useStorefrontNav } from '../../hooks/useStorefrontNav';

export const Route = createFileRoute('/_storefront/wishlist')({
  component: WishlistRoute,
});

function WishlistRoute() {
  const { nav, openProduct, onAdd } = useStorefrontNav();
  return (
    <WishlistPage
      onOpenProduct={openProduct}
      onAdd={onAdd}
      onBrowse={() => nav('catalog')}
    />
  );
}
