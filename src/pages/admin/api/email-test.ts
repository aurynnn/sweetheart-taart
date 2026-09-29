import type { APIRoute } from 'astro';
import { listOrders } from '../../../lib/orderRepo';
import { sendEmail, emailConfigured } from '../../../lib/email/mailer';
import * as templates from '../../../lib/email/templates';
import { EMAIL_RE } from '../../../lib/catalog';

// Admin: send one template (rendered with the latest aanvraag) to an address of choice.
const TEMPLATES = ['aanvraagOntvangen', 'nieuweAanvraag', 'aanvraagBevestigd', 'aanvraagGeweigerd'] as const;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const { to, template } = await request.json().catch(() => ({}));
  if (typeof to !== 'string' || !EMAIL_RE.test(to)) return json({ success: false, error: 'Ongeldig e-mailadres' }, 400);
  if (!TEMPLATES.includes(template)) return json({ success: false, error: 'Onbekende template' }, 400);
  if (!emailConfigured()) return json({ success: false, error: 'E-mail staat uit of MAILERSEND_API_KEY ontbreekt' }, 503);

  const [order] = await listOrders();
  if (!order) return json({ success: false, error: 'Nog geen aanvraag om mee te testen' }, 404);

  const mail = (templates as any)[template](order);
  const result = await sendEmail({ ...mail, subject: `[TEST] ${mail.subject}`, to: [{ email: to }], tag: `test ${template}` });
  return result.ok ? json({ success: true }) : json({ success: false, error: result.error }, 502);
};
