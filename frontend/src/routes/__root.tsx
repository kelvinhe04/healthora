import type { ReactNode } from 'react';
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { ClerkProvider } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ParallaxProvider } from 'react-scroll-parallax';
import { PostHogProvider } from '@posthog/react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PostHogIdentity } from '../components/PostHogIdentity';
import { installGlobalErrorTracking, isPostHogConfigured, posthogOptions, posthogToken } from '../lib/posthog';
import appCss from '../index.css?url';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 1000 * 60 * 5 } },
});

const clerkPk = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
installGlobalErrorTracking();

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'UTF-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { title: 'Healthora' },
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap' },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const app = (
    <ErrorBoundary>
      <ClerkProvider publishableKey={clerkPk} afterSignOutUrl="/">
        <PostHogIdentity />
        <QueryClientProvider client={queryClient}>
          <ParallaxProvider>
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </ParallaxProvider>
        </QueryClientProvider>
      </ClerkProvider>
    </ErrorBoundary>
  );

  return (
    <RootDocument>
      {isPostHogConfigured ? (
        <PostHogProvider apiKey={posthogToken} options={posthogOptions}>
          {app}
        </PostHogProvider>
      ) : (
        app
      )}
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
        <style>{`
          :root {
            --ink: oklch(0.2 0.015 155);
            --ink-80: oklch(0.35 0.015 155);
            --ink-60: oklch(0.5 0.015 155);
            --ink-40: oklch(0.65 0.012 155);
            --ink-20: oklch(0.85 0.012 155);
            --ink-12: oklch(0.88 0.008 155);
            --ink-06: oklch(0.92 0.008 155);
            --ink-04: oklch(0.94 0.006 155);
            --cream: oklch(0.985 0.008 85);
            --cream-2: #E8ECE9;
            --green: oklch(0.35 0.06 155);
            --lime: oklch(0.9 0.18 115);
            --coral: oklch(0.65 0.17 30);
            --skeleton-base: oklch(0.91 0.004 155);
            --skeleton-shimmer: rgba(255,255,255,0.75);
          }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; background: var(--cream); color: var(--ink); font-family: 'Geist', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
          body { overflow-x: hidden; }
          h1, h2, h3, h4 { margin: 0; }
          button { font-family: inherit; }
          a { color: inherit; }
          input, select { font-family: inherit; }
          #root { min-height: 100vh; }
          ::selection { background: var(--lime); color: var(--ink); }
          ::-webkit-scrollbar { width: 10px; height: 10px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: var(--ink-20); border-radius: 999px; }
          ::-webkit-scrollbar-thumb:hover { background: var(--ink-40); }
          @keyframes shimmer {
            from { transform: translateX(-100%); }
            to   { transform: translateX(100%); }
          }
        `}</style>
        <script
          // Anti-FOUC: apply saved theme before React hydrates
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                var stored = JSON.parse(localStorage.getItem('healthora-theme') || '{}');
                if (stored && stored.state && stored.state.theme === 'dark') {
                  document.documentElement.classList.add('dark');
                }
              } catch(e) {}
            })();`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
