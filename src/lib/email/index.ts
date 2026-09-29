// src/lib/email/index.ts — When which e-mail goes out.
//   new aanvraag      → confirmation to the customer + alert to the owner address(es)
//   status approved   → "bevestigd" to the customer
//   status cancelled  → "niet mogelijk" to the customer
//   after pickup      → review request (see sendReviewRequest / scheduler)
// Each kind can be switched off in Admin → Instellingen (lib/emailSettings.ts).

import { SITE } from '../../config/site';
import { getOrder, type FullOrder } from '../orderRepo';
import { getEmailSettings } from '../emailSettings';
import { claimReviewRequest, releaseReviewRequest } from '../reviews';
import { sendEmail, type SendResult } from './mailer';
import { siteUrl } from './layout';
import { aanvraagBevestigd, aanvraagGeweigerd, aanvraagOntvangen, nieuweAanvraag, reviewVerzoek, herinnering, herinneringBevestigen, herinneringIngesteld, type RenderedEmail } from './templates';
import { ratingUrl, unsubscribeUrlForCustomer, unsubscribeUrlForReminder, reminderUrl } from './links';
import { isOptedOut, dueReminders, markReminderSent, type Reminder } from '../reminders';

export { emailConfigured } from './mailer';

const customerAddress = (o: FullOrder) => ({
  email: o.customer.email,
  name: [o.customer.firstname, o.customer.lastname].filter(Boolean).join(' ') || undefined,
});

async function ownerAddresses() {
  const { notifyEmails } = await getEmailSettings();
  return notifyEmails.map((email) => ({ email, name: SITE.owner }));
}

async function toCustomer(order: FullOrder, mail: RenderedEmail, tag: string): Promise<SendResult> {
  const [replyTo] = await ownerAddresses();
  return sendEmail({ ...mail, to: [customerAddress(order)], replyTo: replyTo ?? { email: SITE.email }, tag: `${tag} ${order.id}` });
}

/** Call after a new aanvraag is stored. Resolves once all e-mails were attempted. */
export async function notifyNewAanvraag(orderId: string): Promise<void> {
  const [order, settings] = await Promise.all([getOrder(orderId).catch(() => null), getEmailSettings()]);
  if (!order) return;
  const jobs: Promise<unknown>[] = [];
  if (settings.customerMails) jobs.push(toCustomer(order, aanvraagOntvangen(order), 'aanvraag-ontvangen'));
  if (settings.notifyOnNew && settings.notifyEmails.length) {
    jobs.push(sendEmail({ ...nieuweAanvraag(order), to: await ownerAddresses(), replyTo: customerAddress(order), tag: `nieuwe-aanvraag ${order.id}` }));
  }
  await Promise.all(jobs);
}

export interface MailOutcome { emailed: boolean; to?: string; reason?: string }

/** Call after an admin changes the status. Tells the admin what happened with the mail. */
export async function notifyStatusChange(orderId: string, status: string): Promise<MailOutcome> {
  if (status === 'completed') return sendReviewRequest(orderId);
  if (status !== 'approved' && status !== 'cancelled') return { emailed: false };
  const [order, settings] = await Promise.all([getOrder(orderId).catch(() => null), getEmailSettings()]);
  if (!order) return { emailed: false, reason: 'aanvraag niet gevonden' };
  if (!settings.customerMails) return { emailed: false, reason: 'klantmails staan uit in Instellingen' };
  const mail = status === 'approved' ? aanvraagBevestigd(order) : aanvraagGeweigerd(order);
  const result = await toCustomer(order, mail, status === 'approved' ? 'aanvraag-bevestigd' : 'aanvraag-geweigerd');
  return result.ok ? { emailed: true, to: order.customer.email } : { emailed: false, to: order.customer.email, reason: result.error };
}

export { ratingUrl } from './links';

/** Sends the "hoe was het?" mail once per order. */
export async function sendReviewRequest(orderId: string): Promise<MailOutcome> {
  const settings = await getEmailSettings();
  if (!settings.reviewRequests) return { emailed: false, reason: 'review-mails staan uit in Instellingen' };
  const order = await getOrder(orderId).catch(() => null);
  if (!order || order.status === 'cancelled' || order.status === 'pending') return { emailed: false };
  const to = order.customer.email;
  if (await isOptedOut(to)) return { emailed: false, to, reason: 'klant is uitgeschreven' };
  if (!(await claimReviewRequest(orderId))) return { emailed: false, to, reason: 'review-mail werd al eerder verstuurd' };
  const result = await toCustomer(order, reviewVerzoek(order, { rating: ratingUrl(orderId), unsubscribe: unsubscribeUrlForCustomer(order.customer.id) }), 'review-verzoek');
  if (!result.ok) await releaseReviewRequest(orderId); // try again on the next run
  return result.ok ? { emailed: true, to } : { emailed: false, to, reason: result.error };
}

// ── Reminders ──────────────────────────────────────────────────────────────
async function toReminderOwner(r: Reminder, mail: RenderedEmail, tag: string) {
  const [replyTo] = await ownerAddresses();
  return sendEmail({ ...mail, to: [{ email: r.email }], replyTo: replyTo ?? { email: SITE.email }, tag: `${tag} ${r.id.slice(0, 8)}` });
}

/** Right after a reminder was created: confirmation (verified) or a confirm-link (double opt-in) */
export async function sendReminderCreatedMail(r: Reminder) {
  const cancel = reminderUrl(r.id, 'annuleer');
  const mail = r.status === 'active'
    ? herinneringIngesteld(r, { cancel })
    : herinneringBevestigen(r, { confirm: reminderUrl(r.id, 'bevestig'), cancel });
  return toReminderOwner(r, mail, r.status === 'active' ? 'herinnering-ingesteld' : 'herinnering-bevestigen');
}

/** Scheduler job: send reminders whose date has come (opted-out addresses are skipped in the query) */
export async function sendDueReminders(): Promise<number> {
  const due = await dueReminders();
  let sent = 0;
  for (const r of due) {
    const mail = herinnering(r, {
      order: siteUrl('/aanvraag'),
      cancel: reminderUrl(r.id, 'annuleer'),
      unsubscribe: unsubscribeUrlForReminder(r.id),
    });
    const result = await toReminderOwner(r, mail, 'herinnering');
    if (result.ok) { await markReminderSent(r); sent++; }
  }
  return sent;
}
