import { secureHeaders } from 'hono/secure-headers';

const baseContentSecurityPolicy = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  connectSrc: [
    "'self'",
    'https://api.stripe.com',
    'https://*.stripe.com',
    'https://*.clerk.accounts.dev',
    'https://*.clerk.com',
    'https://*.posthog.com',
    'https://*.i.posthog.com',
  ],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  frameSrc: ["'self'", 'https://*.stripe.com', 'https://*.clerk.accounts.dev', 'https://*.clerk.com'],
  imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
  objectSrc: ["'none'"],
  scriptSrc: ["'self'", "'unsafe-inline'", 'https://*.stripe.com', 'https://*.clerk.accounts.dev', 'https://*.clerk.com'],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  workerSrc: ["'self'", 'blob:'],
  upgradeInsecureRequests: [],
};

const sharedSecureHeaders = {
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin',
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: 'same-origin',
  permissionsPolicy: {
    camera: false,
    microphone: false,
    geolocation: false,
    payment: ['self'],
  },
  removePoweredBy: true,
} as const;

const securityHeadersDefault = secureHeaders({
  contentSecurityPolicy: baseContentSecurityPolicy,
  ...sharedSecureHeaders,
});

// Swagger UI (/docs) carga su JS/CSS desde cdn.jsdelivr.net; el CSP base no lo permite
// y deja la pagina en blanco. Se relaja solo scriptSrc/styleSrc para esta ruta.
const securityHeadersDocs = secureHeaders({
  contentSecurityPolicy: {
    ...baseContentSecurityPolicy,
    scriptSrc: [...baseContentSecurityPolicy.scriptSrc, 'https://cdn.jsdelivr.net'],
    styleSrc: [...baseContentSecurityPolicy.styleSrc, 'https://cdn.jsdelivr.net'],
  },
  ...sharedSecureHeaders,
});

// secure-headers de Hono aplica sus headers luego de `await next()`, es decir al final de la
// cadena de middleware. Por eso la variante relajada para /docs no puede montarse como middleware
// aparte en esa ruta (el global, montado con app.use('*', ...), se ejecutaria despues y la
// pisaria) - hay que decidir cual CSP usar aqui mismo, en el unico middleware global.
export const securityHeaders = (c: Parameters<typeof securityHeadersDefault>[0], next: Parameters<typeof securityHeadersDefault>[1]) =>
  c.req.path === '/docs' ? securityHeadersDocs(c, next) : securityHeadersDefault(c, next);
