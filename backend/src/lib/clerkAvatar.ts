import type { User } from '@clerk/backend';

type RawExternalAccount = { avatar_url?: string };

/** Clerk's own `imageUrl`/`externalAccounts[].imageUrl` always route through Clerk's
 * `img.clerk.com` proxy, even when the source is a Google account's own auto-generated default
 * avatar. That proxy domain isn't guaranteed to resolve on every network - confirmed on one
 * admin's home router: `img.clerk.com` timed out on their default DNS while public resolvers
 * (8.8.8.8, 1.1.1.1) resolved it fine, and the underlying `lh3.googleusercontent.com` URL always
 * loaded (#314). Clerk's SDK types don't surface that underlying URL, but it's present, untyped,
 * on `user.raw.external_accounts[].avatar_url` - use it as a fallback source. */
export function getExternalAvatarUrl(clerkUser: User | null | undefined): string | undefined {
  const rawExternalAccounts = (clerkUser?.raw as { external_accounts?: RawExternalAccount[] } | null | undefined)
    ?.external_accounts;
  return rawExternalAccounts?.find((account) => account.avatar_url)?.avatar_url || undefined;
}
