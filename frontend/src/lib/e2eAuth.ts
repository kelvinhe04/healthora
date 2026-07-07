const E2E_AUTH_STORAGE_KEY = 'healthora-e2e-auth';

export type E2EUser = {
  id: string;
  imageUrl: string;
  fullName: string;
  firstName: string;
  primaryEmailAddress: {
    emailAddress: string;
  };
};

export function getE2EUser(): E2EUser | null {
  if (typeof window === 'undefined') return null;
  if (window.localStorage.getItem(E2E_AUTH_STORAGE_KEY) !== '1') return null;

  return {
    id: 'e2e-user',
    imageUrl: '',
    fullName: 'Usuario E2E',
    firstName: 'Usuario',
    primaryEmailAddress: {
      emailAddress: 'e2e@healthora.dev',
    },
  };
}

export function getE2EAuthToken(): string | null {
  return getE2EUser() ? 'e2e-token' : null;
}
