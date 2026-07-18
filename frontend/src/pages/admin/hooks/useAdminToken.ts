import { useAuth } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import { getE2EAuthToken, isE2EAdmin } from '../../../lib/e2eAuth';

export function useAdminToken() {
  const { getToken } = useAuth();
  const { t } = useTranslation();
  return async () => {
    if (isE2EAdmin()) {
      const e2eToken = getE2EAuthToken();
      if (e2eToken) return e2eToken;
    }
    const token = await getToken();
    if (!token) throw new Error(t('header.errors.needSignIn'));
    return token;
  };
}
