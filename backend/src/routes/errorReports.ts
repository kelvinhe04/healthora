import { Hono } from 'hono';
import { z } from 'zod';
import { captureException } from '../lib/errorTracking';
import { optionalTextField, parseJson, textField } from '../lib/validation';

const clientErrorSchema = z.object({
  name: optionalTextField(120),
  message: textField(2000),
  stack: optionalTextField(12000),
  route: optionalTextField(400),
  userId: optionalTextField(180),
  userEmail: optionalTextField(254),
  posthogDistinctId: optionalTextField(180),
  posthogSessionId: optionalTextField(180),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const errorReportsRouter = new Hono().post('/client', async (c) => {
  const parsed = await parseJson(c, clientErrorSchema);
  if (!parsed.success) return parsed.response;

  const body = parsed.data;
  const error = new Error(body.message);
  error.name = body.name || 'FrontendError';
  error.stack = body.stack;

  captureException({
    source: 'frontend',
    error,
    c,
    user: {
      clerkId: body.userId,
      email: body.userEmail,
    },
    route: body.route,
    method: 'CLIENT',
    posthogDistinctId: body.posthogDistinctId,
    posthogSessionId: body.posthogSessionId,
    userAgent: c.req.header('user-agent'),
    metadata: body.metadata,
  });

  return c.json({ ok: true }, 202);
});
