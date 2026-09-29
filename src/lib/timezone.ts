// src/lib/timezone.ts — The server always works in Belgian time.
// Hosting providers usually run in UTC (1–2 h behind Belgium), which would make
// "today", pickup days and mail hours wrong around midnight. Node picks up a TZ
// change at runtime; import this module first (see middleware.ts).
process.env.TZ = process.env.APP_TIMEZONE || 'Europe/Brussels';
export {};
