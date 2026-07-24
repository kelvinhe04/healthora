import { describe, expect, test } from 'bun:test';
import { getExternalAvatarUrl } from './clerkAvatar';
import type { User } from '@clerk/backend';

function fakeClerkUser(rawExternalAccounts?: { avatar_url?: string }[]) {
  return { raw: { external_accounts: rawExternalAccounts } } as unknown as User;
}

describe('getExternalAvatarUrl', () => {
  test('devuelve el avatar_url de la cuenta externa (ej. Google) cuando existe', () => {
    const url = 'https://lh3.googleusercontent.com/a/foo=s1000-c';
    expect(getExternalAvatarUrl(fakeClerkUser([{ avatar_url: url }]))).toBe(url);
  });

  test('devuelve undefined si no hay cuentas externas', () => {
    expect(getExternalAvatarUrl(fakeClerkUser([]))).toBeUndefined();
  });

  test('devuelve undefined si la cuenta externa no trae avatar_url', () => {
    expect(getExternalAvatarUrl(fakeClerkUser([{}]))).toBeUndefined();
  });

  test('devuelve undefined para un usuario null/undefined', () => {
    expect(getExternalAvatarUrl(null)).toBeUndefined();
    expect(getExternalAvatarUrl(undefined)).toBeUndefined();
  });
});
