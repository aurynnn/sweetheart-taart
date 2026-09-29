// src/lib/email/index.ts — When which e-mail goes out.
//   new aanvraag      → confirmation to the customer + alert to the owner address(es)
//   status approved   → "bevestigd" to the customer
//   status cancelled  → "niet mogelijk" to the customer
//   after pickup      → review request (see sendReviewRequest / scheduler)
// Each kind can be switched off in Admin → Instellingen (lib/emailSettings.ts).

import { SITE } from '../../config/site';
import { getOrder, type FullOrder } from '../orderRepo';
import { getEmailSettings } from '../emailSettings';
import { claimReviewRequest, releaseReviewRequest, reviewToken } from '../reviews';
import { sendEmail, type SendResult } from './mailer';
import { siteUrl } from './layout';
import { aanvraagBevestigd, aanvraagGeweigerd, aanvraagOntvangen, nieuweAanvraag, reviewVerzoek, type RenderedEmail } from './templates';

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

/** Call after an admin changes the status. Returns whether the customer was e-mailed. */
export async function notifyStatusChange(orderId: string, status: string): Promise<boolean> {
  if (status === 'completed') return sendReviewRequest(orderId);
  if (status !== 'approved' && status !== 'cancelled') return false;
  const [order, settings] = await Promise.all([getOrder(orderId).catch(() => null), getEmailSettings()]);
  if (!order || !settings.customerMails) return false;
  const mail = status === 'approved' ? aanvraagBevestigd(order) : aanvraagGeweigerd(order);
  const result = await toCustomer(order, mail, status === 'approved' ? 'aanvraag-bevestigd' : 'aanvraag-geweigerd');
  return result.ok;
}

export const ratingUrl = (orderId: string) => (stars: number) =>
  siteUrl(`/beoordeling?o=${encodeURIComponent(orderId)}&r=${stars}&t=${reviewToken(orderId)}`);

/** Sends the "hoe was het?" mail once per order. Returns whether it was sent now. */
export async function sendReviewRequest(orderId: string): Promise<boolean> {
  const settings = await getEmailSettings();
  if (!settings.reviewRequests) return false;
  const order = await getOrder(orderId).catch(() => null);
  if (!order || order.status === 'cancelled' || order.status === 'pending') return false;
  if (!(await claimReviewRequest(orderId))) return false; // already sent before
  const result = await toCustomer(order, reviewVerzoek(order, ratingUrl(orderId)), 'review-verzoek');
  if (!result.ok) await releaseReviewRequest(orderId); // try again on the next run
  return result.ok;
}
