export type AppEnv = 'development' | 'staging' | 'production';

export function getAppEnv(): AppEnv {
  const raw = (process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();
  if (raw === 'production' || raw === 'prod') return 'production';
  if (raw === 'staging' || raw === 'stage') return 'staging';
  return 'development';
}

export function isProduction(): boolean {
  return getAppEnv() === 'production';
}

export function isStaging(): boolean {
  return getAppEnv() === 'staging';
}

export function getCorsOrigins(): string[] {
  const fromList = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
  if (fromList?.length) return fromList;
  const single = process.env.FRONTEND_URL?.trim();
  return single ? [single] : ['http://localhost:5173'];
}

const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5175', 'http://localhost:3001'];

/** Origins Clerk's verifyToken accepts a session token from (the `azp` claim). Must include every
 * real frontend origin (prod + Vercel previews via CORS_ORIGINS) or Clerk rejects the token with a
 * 401 for every authenticated request from that origin - not just admin routes (see #251: prod
 * only had the dev localhost ports here, so no authenticated call worked from healthora-shop.vercel.app,
 * it just failed silently in the frontend's catch blocks). Dev ports are always included so local
 * dev keeps working regardless of what CORS_ORIGINS/FRONTEND_URL is set to. */
export function getAuthorizedParties(): string[] {
  return Array.from(new Set([...getCorsOrigins(), ...DEV_ORIGINS]));
}
