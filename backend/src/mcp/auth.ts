import { timingSafeEqual } from 'node:crypto';
import { createMiddleware } from 'hono/factory';

/** Constant-time comparison so a wrong token can't be brute-forced by timing how fast the
 * mismatch is detected (a naive `===` returns faster the earlier the first differing byte is). */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Gates the whole /mcp endpoint behind a single service token (`MCP_SERVICE_TOKEN`) - the
 * "API key de servicio MCP" from the historias de usuario, used by headless clients (Claude
 * Code, Codex, ChatGPT connectors) that can't do an interactive Clerk login. Every registered
 * tool is admin-level, so one shared secret is enough; there is no per-user MCP session. */
export const mcpAuth = createMiddleware(async (c, next) => {
  const expected = process.env.MCP_SERVICE_TOKEN;
  if (!expected) {
    return c.json({ error: 'MCP server not configured (MCP_SERVICE_TOKEN missing)' }, 503);
  }

  const authHeader = c.req.header('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!token || !safeEqual(token, expected)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
});
