import { Hono } from 'hono';
import { z } from 'zod';
import { enqueueEmailJob } from '../lib/jobQueue';
import { emailField, parseJson } from '../lib/validation';

const newsletterSchema = z.object({
  email: emailField(),
});

export const newsletterRouter = new Hono()
  .post('/subscribe', async (c) => {
    const parsed = await parseJson(c, newsletterSchema);
    if (!parsed.success) return parsed.response;

    try {
      await enqueueEmailJob('newsletter_subscription', { email: parsed.data.email });
      return c.json({ success: true, message: 'Suscripcion confirmada' });
    } catch (error) {
      console.error('[NEWSLETTER] Failed to queue subscription email:', error);
      return c.json({ error: 'No pudimos procesar el correo de suscripcion' }, 500);
    }
  });
