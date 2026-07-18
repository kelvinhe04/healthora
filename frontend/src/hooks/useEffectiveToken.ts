import { useAuth } from '@clerk/clerk-react';
import { useCallback } from 'react';
import { getE2EAuthToken } from '../lib/e2eAuth';

/** Same signature as Clerk's `getToken` from `useAuth()`, but resolves to the e2e fake token
 * when the e2e auth bypass is active (see `lib/e2eAuth.ts`) instead of hitting Clerk. */
export function useEffectiveToken() {
  const { getToken } = useAuth();
  return useCallback(async () => getE2EAuthToken() ?? getToken(), [getToken]);
}
