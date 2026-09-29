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

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const apiKey = env('MAILERSEND_API_KEY');
  if (env('MAIL_ENABLED') === 'false' || !apiKey) {
    console.info(`[email] skipped (${!apiKey ? 'no MAILERSEND_API_KEY' : 'MAIL_ENABLED=false'}): ${message.tag}`);
    return false;
  }
  const recipients = message.to.filter((r) => r.email && !r.email.endsWith('@sweetheart.local'));
  if (!recipients.length) return false;

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
      console.error(`[email] ✗ ${message.tag} → ${recipients.map((r) => r.email).join(', ')}: ${res.status} ${await res.text()}`);
      return false;
    }
    console.info(`[email] ✓ ${message.tag} → ${recipients.map((r) => r.email).join(', ')}`);
    return true;
  } catch (err) {
    console.error(`[email] ✗ ${message.tag}: ${(err as Error).message}`);
    return false;
  }
}
