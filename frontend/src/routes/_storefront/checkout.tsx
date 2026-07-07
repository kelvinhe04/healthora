import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Checkout } from '../../pages/Checkout';
import { useCartStore } from '../../store/cartStore';
import { useUiStore } from '../../store/uiStore';

export const Route = createFileRoute('/_storefront/checkout')({
  component: CheckoutRoute,
});

function CheckoutRoute() {
  const router = useRouter();
  const cartItems = useCartStore((s) => s.items);
  const checkoutItems = useUiStore((s) => s.checkoutItems);

  return <Checkout items={checkoutItems ?? cartItems} onBack={() => router.history.back()} />;
}
