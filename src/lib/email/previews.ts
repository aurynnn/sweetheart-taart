// src/lib/email/previews.ts — Every e-mail template with example data, for
// /admin/email-preview and the admin test-mail button.

import type { FullOrder } from '../orderRepo';
import * as t from './templates';
import { ratingUrl, unsubscribeUrlForCustomer, reminderUrl } from './links';
import { siteUrl } from './layout';

const sampleReminder = (): t.ReminderView => {
  const d = new Date(); d.setMonth(d.getMonth() + 1);
  return { name: 'Emma', occasion: 'verjaardag', event_date: d.toISOString().slice(0, 10), yearly: 1 };
};

export const PREVIEWS: Record<string, { label: string; render: (order: FullOrder) => t.RenderedEmail }> = {
  aanvraagOntvangen: { label: 'Klant: aanvraag ontvangen', render: (o) => t.aanvraagOntvangen(o) },
  nieuweAanvraag: { label: 'Eigenaar: nieuwe aanvraag', render: (o) => t.nieuweAanvraag(o) },
  aanvraagBevestigd: { label: 'Klant: aanvraag bevestigd', render: (o) => t.aanvraagBevestigd(o) },
  aanvraagGeweigerd: { label: 'Klant: aanvraag niet mogelijk', render: (o) => t.aanvraagGeweigerd(o) },
  reviewVerzoek: {
    label: 'Klant: hoe was het? (review)',
    render: (o) => t.reviewVerzoek(o, { rating: ratingUrl(o.id), unsubscribe: unsubscribeUrlForCustomer(o.customer.id) }),
  },
  herinneringBevestigen: {
    label: 'Herinnering: bevestig je e-mailadres',
    render: () => t.herinneringBevestigen(sampleReminder(), { confirm: reminderUrl('voorbeeld', 'bevestig'), cancel: reminderUrl('voorbeeld', 'annuleer') }),
  },
  herinneringIngesteld: {
    label: 'Herinnering: ingesteld',
    render: () => t.herinneringIngesteld(sampleReminder(), { cancel: reminderUrl('voorbeeld', 'annuleer') }),
  },
  herinnering: {
    label: 'Herinnering: 1 maand op voorhand',
    render: () => t.herinnering(sampleReminder(), { order: siteUrl('/aanvraag'), cancel: reminderUrl('voorbeeld', 'annuleer'), unsubscribe: siteUrl('/uitschrijven') }),
  },
};
