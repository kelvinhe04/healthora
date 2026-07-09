import { useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';

/** Turns a notification's `link` (a plain path string set by the backend, e.g. `/orders`,
 * `/product/olly`, `/admin`) into a typed in-app SPA navigation. Keeps known routes strongly typed
 * and falls back to a raw `to` for anything else. */
export function useNotificationLink() {
  const navigate = useNavigate();

  return useCallback(
    (link: string | null | undefined) => {
      if (!link) return;
      if (link.startsWith('/product/')) {
        const productId = link.slice('/product/'.length);
        if (productId) navigate({ to: '/product/$productId', params: { productId } });
      } else if (link === '/orders') {
        navigate({ to: '/orders' });
      } else if (link === '/admin') {
        navigate({ to: '/admin' });
      } else if (link === '/') {
        navigate({ to: '/' });
      } else {
        navigate({ to: link as never });
      }
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    },
    [navigate],
  );
}
