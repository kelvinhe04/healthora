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

export function getPublicBackendUrl(): string {
  const url = process.env.PUBLIC_BACKEND_URL?.trim();
  return (url || `http://localhost:${process.env.PORT || 3002}`).replace(/\/+$/, '');
}
