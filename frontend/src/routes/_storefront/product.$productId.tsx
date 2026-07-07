import { useEffect } from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { ProductDetail } from '../../pages/ProductDetail';
import { ErrorPage } from '../../pages/ErrorPage';
import { useProduct } from '../../hooks/useProducts';
import { useStorefrontNav } from '../../hooks/useStorefrontNav';
import { useRecentlyViewedStore } from '../../store/recentlyViewedStore';

export const Route = createFileRoute('/_storefront/product/$productId')({
  component: ProductDetailRoute,
});

function ProductDetailRoute() {
  const { productId } = Route.useParams();
  const router = useRouter();
  const { openProduct, onAdd, onBuyNow } = useStorefrontNav();
  const { data: product, isLoading, isError } = useProduct(productId);
  const trackRecentlyViewed = useRecentlyViewedStore((s) => s.track);

  useEffect(() => {
    if (product) trackRecentlyViewed(product.id);
  }, [product, trackRecentlyViewed]);

  useEffect(() => {
    if (product || isLoading || isError) return;
    router.navigate({ to: '/catalog' });
  }, [product, isLoading, isError, router]);

  if (isError) {
    return (
      <ErrorPage
        code={500}
        title={
          <>
            No pudimos cargar el{' '}
            <em style={{ color: 'var(--coral)' }}>producto</em>
          </>
        }
        message="Hubo un problema al consultar este producto. Intenta de nuevo en unos segundos."
        onHome={() => router.navigate({ to: '/' })}
        onCatalog={() => router.navigate({ to: '/catalog' })}
        onRetry={() => window.location.reload()}
      />
    );
  }

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
