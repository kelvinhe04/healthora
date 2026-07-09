import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { NotFoundView } from './components/shared/NotFoundView';
import { RouteErrorView } from './components/shared/RouteErrorView';

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    // The landing restores its own scroll on back-return (see Landing.tsx: a pre-paint hold-loop
    // anchored to the exact card/position). The router's built-in restoration fires a second,
    // redundant window scroll ~1s later (after our hold-loop has ended), which the user sees as the
    // page jumping to place twice. Opt the landing ('/') out so our handler is the single authority;
    // every other route keeps normal router scroll restoration.
    scrollRestoration: ({ location }) => location.pathname !== '/',
    defaultNotFoundComponent: NotFoundView,
    defaultErrorComponent: RouteErrorView,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
