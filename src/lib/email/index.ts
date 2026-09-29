// src/lib/email/index.ts — When which e-mail goes out.
//   new aanvraag      → confirmation to the customer + notification to Nathalie
//   status approved   → "bevestigd" to the customer
//   status cancelled  → "niet mogelijk" to the customer

import { SITE } from '../../config/site';
import { env } from '../env';
import { getOrder, type FullOrder } from '../orderRepo';
import { sendEmail } from './mailer';
import { aanvraagBevestigd, aanvraagGeweigerd, aanvraagOntvangen, nieuweAanvraag, type RenderedEmail } from './templates';

export { emailConfigured } from './mailer';

const customerAddress = (o: FullOrder) => ({
  email: o.customer.email,
  name: [o.customer.firstname, o.customer.lastname].filter(Boolean).join(' ') || undefined,
});

const ownerAddress = () => ({ email: env('ADMIN_NOTIFY_EMAIL', SITE.email)!, name: SITE.owner });

function toCustomer(order: FullOrder, mail: RenderedEmail, tag: string) {
  return sendEmail({ ...mail, to: [customerAddress(order)], replyTo: ownerAddress(), tag: `${tag} ${order.id}` });
}

/** Call after a new aanvraag is stored. Resolves once both e-mails were attempted. */
export async function notifyNewAanvraag(orderId: string): Promise<void> {
  const order = await getOrder(orderId).catch(() => null);
  if (!order) return;
  await Promise.all([
    toCustomer(order, aanvraagOntvangen(order), 'aanvraag-ontvangen'),
    sendEmail({ ...nieuweAanvraag(order), to: [ownerAddress()], replyTo: customerAddress(order), tag: `nieuwe-aanvraag ${order.id}` }),
  ]);
}

/** Call after an admin changes the status. Returns whether the customer was e-mailed. */
export async function notifyStatusChange(orderId: string, status: string): Promise<boolean> {
  if (status !== 'approved' && status !== 'cancelled') return false;
  const order = await getOrder(orderId).catch(() => null);
  if (!order) return false;
  const mail = status === 'approved' ? aanvraagBevestigd(order) : aanvraagGeweigerd(order);
  const result = await toCustomer(order, mail, status === 'approved' ? 'aanvraag-bevestigd' : 'aanvraag-geweigerd');
  return result.ok;
}
