import type { APIRoute } from 'astro';
import { getEmailSettings, normalizeEmailSettings, saveEmailSettings } from '../../../lib/emailSettings';
import { emailConfigured } from '../../../lib/email/mailer';
import { env } from '../../../lib/env';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async () =>
  json({ settings: await getEmailSettings(), configured: emailConfigured(), sender: env('MAIL_FROM_EMAIL') ?? null });

export const POST: APIRoute = async ({ request }) => {
  const settings = normalizeEmailSettings(await request.json().catch(() => ({})));
  if (settings.notifyOnNew && settings.notifyEmails.length === 0) {
    return json({ success: false, error: 'Vul minstens één e-mailadres in voor de meldingen' }, 400);
  }
  await saveEmailSettings(settings);
  return json({ success: true, settings });
};
