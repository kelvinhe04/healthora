import { useAuth } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';

export function useAdminToken() {
  const { getToken } = useAuth();
  const { t } = useTranslation();
  return async () => {
    const token = await getToken();
    if (!token) throw new Error(t('header.errors.needSignIn'));
    return token;
  };
}
