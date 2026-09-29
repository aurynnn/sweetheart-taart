// src/lib/dates.ts — Dates in Belgian time and Belgian notation, everywhere.
//
// - Pickup dates are stored as plain 'YYYY-MM-DD' strings (a calendar day, no time).
// - Timestamps from D1 (datetime('now')) are UTC: 'YYYY-MM-DD HH:MM:SS'.
// - "Today" is always the Belgian today (Europe/Brussels), whatever timezone the
//   server or the visitor's computer runs in.
// Works in both the browser and the server (only uses Intl, no Node APIs).

export const TIME_ZONE = 'Europe/Brussels';
export const LOCALE = 'nl-BE';

const isoFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Belgian calendar date of a moment, as 'YYYY-MM-DD' */
export function belgianIsoDate(moment: Date = new Date()): string {
  return isoFormatter.format(moment); // en-CA formats as YYYY-MM-DD
}

export const todayIso = () => belgianIsoDate(new Date());

/** 'YYYY-MM-DD' ± days (pure calendar arithmetic, no timezone shifts) */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Noon UTC of a calendar day: formatting it in Brussels never slips to another day */
const dayToDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};

const DATE_STYLES = {
  numeric: { day: '2-digit', month: '2-digit', year: 'numeric' },             // 31/10/2026
  short: { day: 'numeric', month: 'short', year: 'numeric' },                 // 31 okt 2026
  long: { day: 'numeric', month: 'long', year: 'numeric' },                   // 31 oktober 2026
  weekday: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, // zaterdag 31 oktober 2026
  weekdayShort: { weekday: 'short', day: 'numeric', month: 'short' },         // za 31 okt
  dayMonth: { day: 'numeric', month: 'long' },                                // 31 oktober
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateStyle = keyof typeof DATE_STYLES;

/** Format a 'YYYY-MM-DD' calendar day the Belgian way */
export function formatDate(iso: string | null | undefined, style: DateStyle = 'long'): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso ?? '';
  return dayToDate(iso.slice(0, 10)).toLocaleDateString(LOCALE, { ...DATE_STYLES[style], timeZone: TIME_ZONE });
}

/** Parse a D1 UTC timestamp ('YYYY-MM-DD HH:MM:SS') or an ISO string */
export function parseTimestamp(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value)) return new Date(value.replace(' ', 'T') + 'Z');
  return new Date(value);
}

/** Format a stored timestamp in Belgian time, e.g. "29/09/2026 21:35" */
export function formatDateTime(value: string | null | undefined, withTime = true): string {
  if (!value) return '';
  const d = parseTimestamp(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString(LOCALE, {
    timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).replace(', ', ' ');
}

/** Current hour in Belgium (0–23), for "only send mails between 9 and 20" */
export function belgianHour(moment: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', hour12: false }).format(moment)) % 24;
}
