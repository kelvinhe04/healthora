/** Notifies other open tabs when the product catalog changes (admin create/update/delete), so a
 * storefront tab left open elsewhere doesn't keep showing stale data until its own staleTime
 * expires. React Query's cache lives in memory per JS runtime — invalidateQueries() in one tab
 * has no effect on another tab's cache, so this bridges them with BroadcastChannel. */
const CHANNEL_NAME = 'healthora-data-sync';

type SyncMessage = { type: 'products-changed' };

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function broadcastProductsChanged(): void {
  getChannel()?.postMessage({ type: 'products-changed' } satisfies SyncMessage);
}

/** Returns an unsubscribe function. */
export function subscribeToProductChanges(onChange: () => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const handler = (event: MessageEvent<SyncMessage>) => {
    if (event.data?.type === 'products-changed') onChange();
  };
  ch.addEventListener('message', handler);
  return () => ch.removeEventListener('message', handler);
}
