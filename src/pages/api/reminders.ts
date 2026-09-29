import { todayIso } from '../../lib/dates';
import type { APIRoute } from 'astro';
import { EMAIL_RE } from '../../lib/catalog';
import { verifyToken } from '../../lib/tokens';
import { getCustomerById } from '../../lib/customers';
import { createReminder, isOptedOut, optIn, OCCASIONS } from '../../lib/reminders';
import { sendReminderCreatedMail } from '../../lib/email';
import { clientIp } from '../../lib/auth';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const WINDOW_MS = 60 * 60_000;
const hits = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 10;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (rateLimited(clientIp(request, clientAddress))) {
    return json({ success: false, error: 'Te veel aanvragen. Probeer het later opnieuw.' }, 429);
  }
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();
  const name = String(body?.name ?? '').trim().slice(0, 60);
  const occasion = String(body?.occasion ?? '');
  const date = String(body?.date ?? '');
  const yearly = body?.yearly !== false;

  if (!EMAIL_RE.test(email)) return json({ success: false, error: 'Vul een geldig e-mailadres in' }, 400);
  if (!OCCASIONS.some((o) => o.value === occasion)) return json({ success: false, error: 'Kies een gelegenheid' }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + 'T00:00:00').getTime())) return json({ success: false, error: 'Kies een geldige datum' }, 400);
  if (!yearly && date < todayIso()) return json({ success: false, error: 'Deze datum ligt in het verleden' }, 400);
  if (body?.consent !== true) return json({ success: false, error: 'Geef toestemming om je een herinnering te mailen' }, 400);

  // Verified when it comes from a signed customer link and the address wasn't changed
  let customerId: string | null = null;
  let verified = false;
  if (body?.c && verifyToken('customer', String(body.c), String(body.t ?? ''))) {
    const customer = await getCustomerById(String(body.c));
    if (customer) {
      customerId = customer.id;
      verified = customer.email.toLowerCase() === email;
    }
  }

  try {
    // Explicitly asking for a reminder with consent overrides an earlier marketing opt-out
    if (verified && (await isOptedOut(email))) await optIn(email);
    const reminder = await createReminder({ email, customerId, name, occasion, date, yearly, verified });
    const mail = await sendReminderCreatedMail(reminder);
    return json({ success: true, status: reminder.status, emailed: mail.ok }, 201);
  } catch (err) {
    console.error('[api/reminders] failed:', err);
    return json({ success: false, error: 'Opslaan mislukt. Probeer het later opnieuw.' }, 500);
  }
};
