// src/lib/orderEvent.ts — How an order looks as an agenda event.
// Shared by the subscription feed (agenda/[token].ics) and the direct Google koppeling,
// so both show the same title, details, colours and reminders.

import { env } from './env';
import { addDays } from './dates';
import { SITE, fullAddress } from '../config/site';
import { itemSummary, productName, formatEuro, type AanvraagItem } from './catalog';
import type { FullOrder } from './orderRepo';

export const CALENDAR_NAME = `${SITE.name} bestellingen`;

export const EVENT_STATUS = {
  pending: { label: '❓ Aanvraag', googleColor: '5', color: 'gold' },     // still to confirm
  approved: { label: '🎂 Ophalen', googleColor: '4', color: 'hotpink' },  // confirmed, to bake
  completed: { label: '✅ Opgehaald', googleColor: '8', color: 'gray' },  // done
} as const;

export interface OrderEvent {
  orderId: string;
  status: keyof typeof EVENT_STATUS;
  title: string;
  description: string;
  location: string;
  url: string;
  /** Timed: date + HH:MM (30 min slot); all-day when time is null */
  date: string;
  time: string | null;
  endDate: string;
  endTime: string | null;
  /** Popup reminders, in minutes before the start */
  alarms: number[];
}

/** Short product label for the title: "Feesttaart 20 p. + 48 koekjes" */
function productsShort(order: FullOrder): string {
  return order.items.map((i) => {
    const name = productName(i.product);
    if (i.product === 'feesttaart') return i.persons ? `${name} ${i.persons} p.` : name;
    return i.quantity ? `${i.quantity} ${name.toLowerCase()}` : name;
  }).join(' + ');
}

export function orderEvent(order: FullOrder): OrderEvent {
  const status = (order.status in EVENT_STATUS ? order.status : 'pending') as OrderEvent['status'];
  const label = EVENT_STATUS[status].label;
  const c = order.customer;
  const who = [c.firstname, c.lastname].filter(Boolean).join(' ') || c.email;
  const hasAllergies = order.items.some((i) => i.allergies);
  const url = `${(env('SITE_URL') || SITE.url).replace(/\/$/, '')}/admin/orders`;

  const description = [
    `${label} · #${order.id}`,
    '',
    ...order.items.flatMap((item) => {
      const summary = itemSummary({ ...(item as AanvraagItem), quantity: item.product === 'feesttaart' ? undefined : item.quantity });
      return [
        `• ${productName(item.product)}${summary ? ` — ${summary}` : ''} (${formatEuro(item.price)})`,
        ...(item.allergies ? [`   ⚠️ Allergieën: ${item.allergies}`] : []),
        ...(item.message ? [`   💬 ${item.message}`] : []),
        ...(item.image ? ['   📷 Voorbeeldfoto in het dashboard'] : []),
      ];
    }),
    `Totaal (indicatie): ${order.total}`,
    '',
    `👤 ${who}`,
    ...(c.phone ? [`📞 ${c.phone}`] : []),
    ...(c.email && !c.email.endsWith('.local') ? [`✉️ ${c.email}`] : []),
    ...(order.message ? ['', `Opmerking: ${order.message}`] : []),
    '',
    `Dashboard: ${url}`,
  ].join('\n');

  // Pickup slot of 30 min; without a time it becomes an all-day event
  let time: string | null = null, endDate = addDays(order.date, 1), endTime: string | null = null, minutesIntoDay = 0;
  if (order.time && /^\d{2}:\d{2}$/.test(order.time)) {
    const [h, m] = order.time.split(':').map(Number);
    const endMin = h * 60 + m + 30;
    time = order.time;
    endTime = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    endDate = endMin >= 1440 ? addDays(order.date, 1) : order.date;
    minutesIntoDay = h * 60 + m;
  }

  // Confirmed orders: a nudge at 08:00 the day before (time to bake) and 1 hour before pickup
  const alarms = status === 'approved' ? [minutesIntoDay + 16 * 60, ...(time ? [60] : [])] : [];

  return {
    orderId: order.id,
    status,
    title: `${hasAllergies ? '⚠️ ' : ''}${label} · ${who} — ${productsShort(order)}`,
    description,
    location: fullAddress,
    url,
    date: order.date,
    time,
    endDate,
    endTime,
    alarms,
  };
}
