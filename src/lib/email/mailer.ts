// src/lib/email/mailer.ts — Sends e-mail through the MailerSend REST API.
//
// Env:
//   MAILERSEND_API_KEY   required; without it e-mails are skipped (logged)
//   MAIL_FROM_EMAIL      sender, must be on a domain verified in MailerSend
//   MAIL_FROM_NAME       sender name (default "Sweetheart")
//   MAIL_ENABLED         set to "false" to switch all e-mail off (e.g. while testing)
//
// sendEmail() never throws: an e-mail problem must never break an aanvraag.

import { env } from '../env';
import { SITE } from '../../config/site';

export interface Address { email: string; name?: string }

export interface EmailMessage {
  to: Address[];
  subject: string;
  html: string;
  text: string;
  replyTo?: Address;
  /** Short label for the logs, e.g. "aanvraag-ontvangen ORD-007" */
  tag: string;
}

const API_URL = 'https://api.mailersend.com/v1/email';
const TIMEOUT_MS = 10_000;

export function emailConfigured(): boolean {
  return env('MAIL_ENABLED') !== 'false' && !!env('MAILERSEND_API_KEY');
}

/** Logs must not contain full personal data: "jo•••@gmail.com" */
const mask = (email: string) => email.replace(/^(.{2})[^@]*(@.*)$/, '$1•••$2');

export interface SendResult { ok: boolean; error?: string }

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = env('MAILERSEND_API_KEY');
  if (env('MAIL_ENABLED') === 'false' || !apiKey) {
    const reason = !apiKey ? 'MAILERSEND_API_KEY ontbreekt' : 'MAIL_ENABLED=false';
    console.info(`[email] skipped (${reason}): ${message.tag}`);
    return { ok: false, error: reason };
  }
  const recipients = message.to.filter((r) => r.email && !r.email.endsWith('@sweetheart.local'));
  if (!recipients.length) return { ok: false, error: 'Geen geldige ontvanger' };

  const body = {
    from: { email: env('MAIL_FROM_EMAIL', SITE.email), name: env('MAIL_FROM_NAME', SITE.name) },
    to: recipients,
    reply_to: message.replyTo,
    subject: message.subject,
    html: message.html,
    text: message.text,
  };

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[email] ✗ ${message.tag} → ${recipients.map((r) => mask(r.email)).join(', ')}: ${res.status} ${detail}`);
      let error = `MailerSend ${res.status}`;
      try { error += `: ${JSON.parse(detail).message}`; } catch { /* not JSON */ }
      return { ok: false, error };
    }
    console.info(`[email] ✓ ${message.tag} → ${recipients.map((r) => mask(r.email)).join(', ')}`);
    return { ok: true };
  } catch (err) {
    console.error(`[email] ✗ ${message.tag}: ${(err as Error).message}`);
    return { ok: false, error: (err as Error).message };
  }
}
