import { createFileRoute } from '@tanstack/react-router';
import { SamplePicker } from '../../pages/SamplePicker';
import { useStorefrontNav } from '../../hooks/useStorefrontNav';
import { useUiStore } from '../../store/uiStore';

export const Route = createFileRoute('/_storefront/sample-picker')({
  component: SamplePickerRoute,
});

function SamplePickerRoute() {
  const { nav } = useStorefrontNav();
  const setCartOpen = useUiStore((s) => s.setCartOpen);

  const backToCartAndCatalog = () => {
    nav('catalog');
    setCartOpen(true);
  };

  return <SamplePicker onBack={backToCartAndCatalog} onConfirm={backToCartAndCatalog} />;
}
