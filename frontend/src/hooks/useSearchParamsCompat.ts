import { useMemo } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';

type SetSearchParams = (
  updater: (prev: URLSearchParams) => URLSearchParams,
  opts?: { replace?: boolean },
) => void;

/**
 * Drop-in replacement for react-router-dom's useSearchParams(), backed by
 * TanStack Router, so components that manipulate URLSearchParams directly
 * (e.g. the admin panel) don't need to be rewritten.
 */
export function useSearchParamsCompat(): [URLSearchParams, SetSearchParams] {
  const location = useLocation();
  const navigate = useNavigate();
  // Memoized on the query string itself, not just re-created every render: consumers that sync
  // local state off this value in a `useEffect([searchParams])` (e.g. the header search box) would
  // otherwise see a "new" object on every unrelated re-render and re-run that effect, clobbering
  // whatever the user just typed before the URL itself ever changed.
  const searchParams = useMemo(() => new URLSearchParams(location.searchStr ?? ''), [location.searchStr]);

  const setSearchParams: SetSearchParams = (updater, opts) => {
    const prev = new URLSearchParams(location.searchStr ?? '');
    const next = updater(prev);
    const nextSearch: Record<string, string> = {};
    next.forEach((value, key) => { nextSearch[key] = value; });
    // The router has `scrollRestoration: true`, which resets scroll to top on every navigation
    // by default - including these search-param-only updates (e.g. opening a modal). This hook
    // is just syncing UI state to the URL, not actually changing pages, so scroll must stay put.
    navigate({ search: () => nextSearch, replace: opts?.replace, resetScroll: false } as unknown as Parameters<typeof navigate>[0]);
  };

  return [searchParams, setSearchParams];
}
