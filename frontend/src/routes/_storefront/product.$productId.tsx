import { useEffect } from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { ProductDetail } from '../../pages/ProductDetail';
import { useProduct } from '../../hooks/useProducts';
import { useStorefrontNav } from '../../hooks/useStorefrontNav';

export const Route = createFileRoute('/_storefront/product/$productId')({
  component: ProductDetailRoute,
});

function ProductDetailRoute() {
  const { productId } = Route.useParams();
  const router = useRouter();
  const { openProduct, onAdd, onBuyNow } = useStorefrontNav();
  const { data: product, isLoading } = useProduct(productId);

  useEffect(() => {
    if (product || isLoading) return;
    router.navigate({ to: '/catalog' });
  }, [product, isLoading, router]);

  if (!product) return null;

  return (
    <ProductDetail
      product={product}
      onAdd={onAdd}
      onBuyNow={onBuyNow}
      onOpenProduct={openProduct}
      onBack={() => router.history.back()}
    />
  );
}
