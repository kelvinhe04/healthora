/** Resolve the WebSocket URL for the notification channel (HU-061).
 *
 * Dev: same origin - the Vite proxy (`ws: true`) tunnels `/api/notifications/ws` to the backend,
 * so the browser only ever talks to its own origin.
 *
 * Prod: set `VITE_BACKEND_WS_URL` (e.g. `wss://api.example.com`) or `VITE_BACKEND_URL`
 * (`https://api.example.com`, auto-converted to `wss://`). This is needed because the platform's
 * `/api` rewrite (Vercel) proxies HTTP but not WebSocket upgrades - so the socket connects to the
 * backend host directly, while REST keeps flowing through `/api`. If neither is set we fall back
 * to same-origin; if that also can't upgrade, the app degrades gracefully to REST polling. */
export function getNotificationsWsUrl(token: string): string {
  const explicitWs = (import.meta.env.VITE_BACKEND_WS_URL as string | undefined)?.trim();
  const backendHttp = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();

  let base: string;
  if (explicitWs) {
    base = `${explicitWs.replace(/\/$/, '')}/notifications/ws`;
  } else if (backendHttp) {
    base = `${backendHttp.replace(/^http/, 'ws').replace(/\/$/, '')}/notifications/ws`;
  } else {
    if (import.meta.env.PROD) {
      // Falls back to a same-origin socket that a platform rewrite (Vercel) can't upgrade - see
      // #254. Not thrown as an error since the rest of the app should keep working without
      // realtime notifications, but this is almost certainly a missing env var, not intentional.
      console.warn(
        '[notifications] VITE_BACKEND_WS_URL/VITE_BACKEND_URL no configuradas - el socket va a intentar mismo-origen y probablemente falle detras de un rewrite (ver frontend/.env.example).',
      );
    }
    const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost';
    base = `${proto}://${host}/api/notifications/ws`;
  }

  return `${base}?token=${encodeURIComponent(token)}`;
}
