import { useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';

/** Turns a notification's `link` (a plain path[?query] string set by the backend, e.g. `/orders`,
 * `/product/olly`, `/admin?section=products&modal=edit&productId=...&highlightVariant=...`) into a
 * typed in-app SPA navigation. Keeps known routes strongly typed and falls back to a raw `to` with
 * parsed search params for anything else - query strings must survive the navigation (e.g. the
 * low-stock deep link that opens the admin edit modal positioned at a specific variant). */
export function useNotificationLink() {
  const navigate = useNavigate();

  return useCallback(
    (link: string | null | undefined) => {
      if (!link) return;

      const [pathname, queryString] = link.split('?');
      const search = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : undefined;

      if (pathname.startsWith('/product/')) {
        const productId = pathname.slice('/product/'.length);
        if (productId) navigate({ to: '/product/$productId', params: { productId } });
      } else if (pathname === '/orders') {
        navigate({ to: '/orders' });
      } else if (pathname === '/admin') {
        navigate({ to: '/admin', search: search as never });
      } else if (pathname === '/') {
        navigate({ to: '/' });
      } else {
        navigate({ to: pathname as never, search: search as never });
      }
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    },
    [navigate],
  );
}
