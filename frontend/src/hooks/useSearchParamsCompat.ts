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
  const searchParams = new URLSearchParams(location.searchStr ?? '');

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
