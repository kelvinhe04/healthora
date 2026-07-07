import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { securityHeaders } from './securityHeaders';

describe('securityHeaders', () => {
  test('sets CSP, HSTS and frame protection headers', async () => {
    const app = new Hono();
    app.use('*', securityHeaders);
    app.get('/health', (c) => c.json({ ok: true }));

    const response = await app.request('/health');

    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(response.headers.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains; preload');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
