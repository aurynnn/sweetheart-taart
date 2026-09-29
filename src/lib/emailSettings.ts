// src/lib/emailSettings.ts — E-mail preferences managed from Admin → Instellingen.
// Stored as JSON in app_settings['email_settings'] (no migration needed).

import { d1Query } from './d1';
import { env } from './env';
import { SITE } from '../config/site';
import { EMAIL_RE } from './catalog';

export interface EmailSettings {
  /** Who gets "nieuwe aanvraag" alerts */
  notifyEmails: string[];
  /** Alert the owner on every new aanvraag */
  notifyOnNew: boolean;
  /** Confirmation / bevestigd / niet mogelijk mails to customers */
  customerMails: boolean;
  /** Ask for a review the day after pickup (or when marked voltooid) */
  reviewRequests: boolean;
}

const KEY = 'email_settings';
let cache: { at: number; value: EmailSettings } | null = null;

export function defaultEmailSettings(): EmailSettings {
  return {
    notifyEmails: [env('ADMIN_NOTIFY_EMAIL', SITE.email)!],
    notifyOnNew: true,
    customerMails: true,
    reviewRequests: true,
  };
}

export function normalizeEmailSettings(input: any): EmailSettings {
  const base = defaultEmailSettings();
  const emails = Array.isArray(input?.notifyEmails)
    ? [...new Set(input.notifyEmails.map((e: unknown) => String(e).trim().toLowerCase()).filter((e: string) => EMAIL_RE.test(e)))].slice(0, 5) as string[]
    : base.notifyEmails;
  return {
    notifyEmails: emails,
    notifyOnNew: typeof input?.notifyOnNew === 'boolean' ? input.notifyOnNew : base.notifyOnNew,
    customerMails: typeof input?.customerMails === 'boolean' ? input.customerMails : base.customerMails,
    reviewRequests: typeof input?.reviewRequests === 'boolean' ? input.reviewRequests : base.reviewRequests,
  };
}

export async function getEmailSettings(): Promise<EmailSettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  let value = defaultEmailSettings();
  try {
    const res = await d1Query('SELECT value FROM app_settings WHERE key = ?', [KEY]);
    const raw = res.results?.[0]?.value as string | undefined;
    if (raw) value = normalizeEmailSettings(JSON.parse(raw));
  } catch (err) {
    console.warn('[emailSettings] using defaults:', (err as Error).message);
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function saveEmailSettings(value: EmailSettings): Promise<void> {
  await d1Query('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [KEY, JSON.stringify(value)]);
  cache = { at: Date.now(), value };
}
