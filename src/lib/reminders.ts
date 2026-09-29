// src/lib/reminders.ts — "Herinner me": a mail 1 month before a birthday/occasion.
//
// GDPR: reminders are opt-in only. From a signed customer link (address already
// verified) the reminder is active straight away; an address typed on the website
// must first be confirmed via a link in a mail (double opt-in). Every reminder mail
// has a cancel link, and opted-out addresses never get reminders.

import { randomUUID } from 'node:crypto';
import { d1Query } from './d1';
import { toLocalDateStr } from './availability';
import { belgianNow } from './dates';

export const REMIND_DAYS_BEFORE = 30;

export const OCCASIONS = [
  { value: 'verjaardag', label: 'Verjaardag' },
  { value: 'communie', label: 'Communie' },
  { value: 'lentefeest', label: 'Lentefeest' },
  { value: 'doopsel', label: 'Doopsel' },
  { value: 'huwelijksverjaardag', label: 'Huwelijksverjaardag' },
  { value: 'jubileum', label: 'Jubileum' },
  { value: 'anders', label: 'Ander feest' },
];

export const occasionLabel = (v: string) => OCCASIONS.find((o) => o.value === v)?.label ?? v;

export interface Reminder {
  id: string; email: string; customer_id: string | null; name: string | null; occasion: string;
  event_date: string; remind_at: string; yearly: number; status: 'pending' | 'active' | 'sent' | 'cancelled';
  source: string | null; consent_at: string | null; last_sent_at: string | null; created_at: string;
}

const DDL = [
  `CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY, email TEXT NOT NULL, customer_id TEXT, name TEXT, occasion TEXT NOT NULL,
    event_date TEXT NOT NULL, remind_at TEXT NOT NULL, yearly INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending', source TEXT, consent_at TEXT, last_sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders (status, remind_at)`,
  `CREATE INDEX IF NOT EXISTS idx_reminders_email ON reminders (email)`,
  `CREATE TABLE IF NOT EXISTS email_optouts (email TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
];

let ensured = false;
export async function ensureReminderTables() {
  if (ensured) return;
  for (const sql of DDL) await d1Query(sql);
  ensured = true;
}

/** Next occurrence of a (month, day) on or after `from`, as YYYY-MM-DD */
export function nextOccurrence(dateIso: string, from = belgianNow()): string {
  const [, m, d] = dateIso.split('-').map(Number);
  const today = new Date(from); today.setHours(0, 0, 0, 0);
  let year = today.getFullYear();
  let candidate = new Date(year, m - 1, d);
  // A reminder needs at least a few days to be useful; otherwise use next year
  if (candidate.getTime() < today.getTime() + 3 * 86400000) candidate = new Date(++year, m - 1, d);
  return toLocalDateStr(candidate);
}

export function remindDateFor(eventIso: string): string {
  const d = new Date(eventIso + 'T00:00:00');
  d.setDate(d.getDate() - REMIND_DAYS_BEFORE);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return toLocalDateStr(d < today ? today : d); // less than a month away → remind right away
}

export async function createReminder(input: {
  email: string; customerId?: string | null; name?: string; occasion: string; date: string; yearly: boolean; verified: boolean;
}): Promise<Reminder> {
  await ensureReminderTables();
  const eventDate = input.yearly ? nextOccurrence(input.date) : input.date;
  const reminder: Reminder = {
    id: randomUUID(),
    email: input.email.toLowerCase(),
    customer_id: input.customerId ?? null,
    name: input.name?.trim() || null,
    occasion: input.occasion,
    event_date: eventDate,
    remind_at: remindDateFor(eventDate),
    yearly: input.yearly ? 1 : 0,
    status: input.verified ? 'active' : 'pending',
    source: input.verified ? 'mail' : 'website',
    consent_at: input.verified ? new Date().toISOString() : null,
    last_sent_at: null,
    created_at: new Date().toISOString(),
  };
  await d1Query(
    `INSERT INTO reminders (id, email, customer_id, name, occasion, event_date, remind_at, yearly, status, source, consent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [reminder.id, reminder.email, reminder.customer_id, reminder.name, reminder.occasion, reminder.event_date,
      reminder.remind_at, reminder.yearly, reminder.status, reminder.source, reminder.consent_at]
  );
  return reminder;
}

export async function getReminder(id: string): Promise<Reminder | null> {
  await ensureReminderTables();
  const res = await d1Query('SELECT * FROM reminders WHERE id = ?', [id]);
  return (res.results?.[0] as Reminder) ?? null;
}

export async function confirmReminder(id: string) {
  await d1Query(`UPDATE reminders SET status = 'active', consent_at = datetime('now') WHERE id = ? AND status = 'pending'`, [id]);
}

export async function cancelReminder(id: string) {
  await d1Query(`UPDATE reminders SET status = 'cancelled' WHERE id = ?`, [id]);
}

export async function listReminders(filter: { email?: string } = {}): Promise<Reminder[]> {
  await ensureReminderTables();
  const res = filter.email
    ? await d1Query('SELECT * FROM reminders WHERE email = ? ORDER BY remind_at', [filter.email.toLowerCase()])
    : await d1Query('SELECT * FROM reminders ORDER BY created_at DESC');
  return (res.results || []) as Reminder[];
}

/** Active reminders whose remind date has come, excluding opted-out addresses */
export async function dueReminders(): Promise<Reminder[]> {
  await ensureReminderTables();
  const res = await d1Query(
    `SELECT r.* FROM reminders r LEFT JOIN email_optouts x ON x.email = r.email
     WHERE r.status = 'active' AND r.remind_at <= ? AND x.email IS NULL`,
    [toLocalDateStr(new Date())]
  );
  return (res.results || []) as Reminder[];
}

/** After sending: yearly reminders roll over to next year, one-off ones are done */
export async function markReminderSent(r: Reminder) {
  if (r.yearly) {
    const next = new Date(r.event_date + 'T00:00:00');
    next.setFullYear(next.getFullYear() + 1);
    const eventDate = toLocalDateStr(next);
    await d1Query(`UPDATE reminders SET event_date = ?, remind_at = ?, last_sent_at = datetime('now') WHERE id = ?`, [eventDate, remindDateFor(eventDate), r.id]);
  } else {
    await d1Query(`UPDATE reminders SET status = 'sent', last_sent_at = datetime('now') WHERE id = ?`, [r.id]);
  }
}

// ── Marketing opt-outs ─────────────────────────────────────────────────────
export async function isOptedOut(email: string): Promise<boolean> {
  await ensureReminderTables();
  const res = await d1Query('SELECT 1 FROM email_optouts WHERE email = ?', [email.toLowerCase()]);
  return (res.results || []).length > 0;
}

export async function optOut(email: string) {
  await ensureReminderTables();
  await d1Query('INSERT OR IGNORE INTO email_optouts (email) VALUES (?)', [email.toLowerCase()]);
  await d1Query(`UPDATE reminders SET status = 'cancelled' WHERE email = ? AND status IN ('pending', 'active')`, [email.toLowerCase()]);
}

export async function optIn(email: string) {
  await ensureReminderTables();
  await d1Query('DELETE FROM email_optouts WHERE email = ?', [email.toLowerCase()]);
}

export async function listOptouts(): Promise<Set<string>> {
  await ensureReminderTables();
  const res = await d1Query('SELECT email FROM email_optouts');
  return new Set((res.results || []).map((r: any) => String(r.email)));
}
