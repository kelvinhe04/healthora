import { useAuth } from '@clerk/clerk-react';

export function useAdminToken() {
  const { getToken } = useAuth();
  return async () => {
    const token = await getToken();
    if (!token) throw new Error("Necesitas iniciar sesión");
    return token;
  };
}
