// src/lib/calendarFeed.ts — Orders as an agenda subscription (iCal feed), no Google setup needed.
//
// The admin gets a private link /agenda/<token>.ics and adds it to Google Agenda, Apple
// Agenda or Outlook with one click ("abonneren"). The agenda app then fetches the feed
// by itself. Trade-off: Google refreshes subscribed agendas only a few times a day
// (Apple/Outlook more often), so a new aanvraag can take a while to appear.
// Anyone with the link can read the orders: it can be replaced in the admin.

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { d1Query } from './d1';
import { TIME_ZONE, todayIso, addDays } from './dates';
import { listOrders, type FullOrder } from './orderRepo';
import { orderEvent, EVENT_STATUS, CALENDAR_NAME } from './orderEvent';
import { SITE } from '../config/site';

const KEY = 'calendar_feed_token';

async function readToken(): Promise<string | null> {
  const res = await d1Query('SELECT value FROM app_settings WHERE key = ?', [KEY]);
  return (res.results?.[0]?.value as string | undefined) ?? null;
}

/** The current feed token, created on first use */
export async function getFeedToken(): Promise<string> {
  const existing = await readToken();
  if (existing) return existing;
  return resetFeedToken();
}

/** New link; the old one stops working immediately */
export async function resetFeedToken(): Promise<string> {
  const token = randomBytes(24).toString('hex');
  await d1Query('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [KEY, token]);
  return token;
}

export async function isValidFeedToken(given: string): Promise<boolean> {
  if (!/^[0-9a-f]{48}$/.test(given)) return false;
  const token = await readToken().catch(() => null);
  return !!token && timingSafeEqual(Buffer.from(token), Buffer.from(given));
}

// ── iCalendar (RFC 5545) ───────────────────────────────────────────────────

const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Lines may be at most 75 bytes; continuation lines start with a space */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  for (const ch of line) {
    if (new TextEncoder().encode(current + ch).length > (parts.length ? 74 : 75)) { parts.push(current); current = ''; }
    current += ch;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const compactDate = (iso: string) => iso.replace(/-/g, '');
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// Belgian time incl. summer/winter time, so timed events land on the right hour everywhere
const VTIMEZONE = [
  'BEGIN:VTIMEZONE', `TZID:${TIME_ZONE}`,
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

export async function renderFeed(): Promise<string> {
  // Last month for reference + everything upcoming; cancelled orders simply drop out
  return renderCalendar(await listOrders({ dateFrom: addDays(todayIso(), -30) }));
}

export function renderCalendar(allOrders: FullOrder[]): string {
  const orders = allOrders.filter((o) => o.status !== 'cancelled');
  const now = stamp();
  const host = new URL(SITE.url).hostname;

  const events = orders.flatMap((order) => {
    const e = orderEvent(order);
    const when = e.time
      ? [`DTSTART;TZID=${TIME_ZONE}:${compactDate(e.date)}T${e.time.replace(':', '')}00`, `DTEND;TZID=${TIME_ZONE}:${compactDate(e.endDate)}T${e.endTime!.replace(':', '')}00`]
      : [`DTSTART;VALUE=DATE:${compactDate(e.date)}`, `DTEND;VALUE=DATE:${compactDate(e.endDate)}`];
    return [
      'BEGIN:VEVENT',
      `UID:${e.orderId.toLowerCase()}@${host}`,
      `DTSTAMP:${now}`,
      ...when,
      `SUMMARY:${escapeText(e.title)}`,
      `DESCRIPTION:${escapeText(e.description)}`,
      `LOCATION:${escapeText(e.location)}`,
      `URL:${e.url}`,
      `STATUS:${e.status === 'pending' ? 'TENTATIVE' : 'CONFIRMED'}`,
      `TRANSP:${e.status === 'pending' ? 'TRANSPARENT' : 'OPAQUE'}`,
      `COLOR:${EVENT_STATUS[e.status].color}`,
      ...e.alarms.flatMap((min) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(e.title)}`, `TRIGGER:-PT${min}M`, 'END:VALARM']),
      'END:VEVENT',
    ];
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${SITE.name}//Bestellingen//NL`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(CALENDAR_NAME)}`,
    `X-WR-TIMEZONE:${TIME_ZONE}`,
    // Hint for Apple/Outlook to check every 15 minutes (Google decides for itself)
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
    ...VTIMEZONE,
    ...events,
    'END:VCALENDAR',
  ].map(fold).join('\r\n') + '\r\n';
}
