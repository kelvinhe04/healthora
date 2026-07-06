import { Hono } from 'hono';
import { z } from 'zod';
import { sendNewsletterSubscriptionEmail } from '../lib/email';
import { emailField, parseJson } from '../lib/validation';

const newsletterSchema = z.object({
  email: emailField(),
});

export const newsletterRouter = new Hono()
  .post('/subscribe', async (c) => {
    const parsed = await parseJson(c, newsletterSchema);
    if (!parsed.success) return parsed.response;

    try {
      await sendNewsletterSubscriptionEmail({ email: parsed.data.email });
      return c.json({ success: true, message: 'Suscripcion confirmada' });
    } catch (error) {
      console.error('[NEWSLETTER] Failed to send subscription email:', error);
      return c.json({ error: 'No pudimos enviar el correo de suscripcion' }, 500);
    }
  });
