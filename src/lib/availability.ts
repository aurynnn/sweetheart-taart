// src/lib/availability.ts — Single source of truth for which pickup dates are open.
// Used by GET /api/availability (calendar) and POST /api/orders (server-side check),
// so the customer can never submit a date the calendar would have refused.

import { d1Query } from './d1';

export interface DayAvailability {
  date: string;
  available: boolean;
  orders: number;
  maxOrders: number;
  remaining: number;
  reason?: string;
}

export interface AvailabilitySettings {
  recurringUnavailableDays: number[];
  availableDays: number[];
  maxOrdersPerDay: number;
  leadTimeDays: number;
  blockedDates: Array<{ date: string; reason: string; max_orders: number }>;
}

const DAY_NAMES = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];

// Build YYYY-MM-DD in local time (not UTC) to match frontend date strings and avoid off-by-one
export function toLocalDateStr(d: Date) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export async function getAvailability(startDate: string | null, endDate: string | null): Promise<{
  settings: AvailabilitySettings;
  availability: DayAvailability[];
}> {
  // Fetch lead time setting
  let leadTimeDays = 0;
  try {
    const leadResult = await d1Query("SELECT value FROM app_settings WHERE key = 'lead_time_days'");
    if (leadResult.results?.[0]?.value) {
      leadTimeDays = parseInt(leadResult.results[0].value as string, 10) || 0;
    }
  } catch { /* table may not exist yet */ }

  // Fetch recurring schedule
  const recurringResult = await d1Query(
    'SELECT day_of_week, enabled, max_orders FROM recurring_schedule'
  );

  const recurringUnavailable: number[] = [];
  const recurringAvailable: number[] = [];
  let defaultMaxOrders = 3;

  for (const row of recurringResult.results || []) {
    if (row.day_of_week !== undefined) {
      if (row.enabled === 0 || row.enabled === false) {
        recurringUnavailable.push(row.day_of_week as number);
      } else {
        recurringAvailable.push(row.day_of_week as number);
        if (row.max_orders) defaultMaxOrders = row.max_orders as number;
      }
    }
  }

  if (recurringResult.results?.length === 0) {
    for (let d = 1; d <= 6; d++) recurringAvailable.push(d);
    recurringUnavailable.push(0); // Sunday
  }

  // Fetch per-date overrides
  const overrideResult = await d1Query(
    'SELECT date, mode, max_orders, reason FROM availability_days'
  );

  const overrides: Record<string, { mode: string; max_orders: number; reason?: string }> = {};
  for (const row of overrideResult.results || []) {
    if (row.date) {
      overrides[row.date as string] = {
        mode: row.mode as string,
        max_orders: row.max_orders as number ?? defaultMaxOrders,
        reason: row.reason as string | undefined,
      };
    }
  }

  // Count orders per date
  const orderCounts: Record<string, number> = {};
  if (startDate && endDate) {
    const countResult = await d1Query(
      `SELECT date, COUNT(*) as cnt FROM orders
       WHERE date >= ? AND date <= ? AND status != 'cancelled'
       GROUP BY date`,
      [startDate, endDate]
    );
    for (const row of countResult.results || []) {
      orderCounts[row.date as string] = row.cnt as number;
    }
  }

  const availability: DayAvailability[] = [];

  if (startDate && endDate) {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const leadTimeCutoff = new Date(today);
    leadTimeCutoff.setDate(leadTimeCutoff.getDate() + leadTimeDays);
    const current = new Date(start);

    while (current <= end) {
      const dateStr = toLocalDateStr(current);
      const dayOfWeek = current.getDay();
      const ordersCount = orderCounts[dateStr] || 0;
      const isPast = current < today;
      const isRecurringUnavailable = recurringUnavailable.includes(dayOfWeek);
      const isRecurringAvailable = recurringAvailable.includes(dayOfWeek);

      let reason: string | undefined;
      let isAvailable = true;
      let maxOrders = defaultMaxOrders;

      const override = overrides[dateStr];
      if (override) {
        if (override.mode === 'geblokkeerd') {
          isAvailable = false;
          reason = override.reason || 'Geblokkeerd';
          maxOrders = override.max_orders;
        } else if (override.mode === 'vol') {
          isAvailable = false;
          reason = override.reason || 'Vol';
          maxOrders = override.max_orders;
        } else if (override.mode === 'beperkt') {
          isAvailable = true;
          reason = override.reason || undefined;
          maxOrders = override.max_orders;
        } else if (override.mode === 'open') {
          isAvailable = true;
          maxOrders = override.max_orders;
        }
      } else if (current < leadTimeCutoff) {
        isAvailable = false;
        reason = leadTimeDays > 0
          ? `Aanvragen minstens ${leadTimeDays} dag${leadTimeDays === 1 ? '' : 'en'} op voorhand`
          : 'Datum is voorbij';
      } else if (isPast) {
        isAvailable = false;
        reason = 'Datum is voorbij';
      } else if (isRecurringUnavailable) {
        isAvailable = false;
        reason = `Elke ${DAY_NAMES[dayOfWeek]} gesloten`;
      } else if (ordersCount >= maxOrders) {
        isAvailable = false;
        reason = 'Volledig bezet';
      } else if (!isRecurringAvailable) {
        isAvailable = false;
        reason = `Elke ${DAY_NAMES[dayOfWeek]} gesloten`;
      }

      // Overrides can re-open a date, but never beyond its capacity or into the past
      if (isAvailable && (isPast || ordersCount >= maxOrders)) {
        isAvailable = false;
        reason = isPast ? 'Datum is voorbij' : 'Volledig bezet';
      }

      availability.push({
        date: dateStr,
        available: isAvailable,
        orders: ordersCount,
        maxOrders,
        remaining: Math.max(0, maxOrders - ordersCount),
        reason,
      });

      current.setDate(current.getDate() + 1);
    }
  }

  // Extract blocked dates from overrides (mode = 'geblokkeerd')
  const blockedDates = Object.entries(overrides)
    .filter(([, v]) => v.mode === 'geblokkeerd')
    .map(([date, v]) => ({
      date,
      reason: v.reason || 'Geblokkeerd',
      max_orders: v.max_orders,
    }));

  return {
    settings: {
      recurringUnavailableDays: recurringUnavailable,
      availableDays: recurringAvailable,
      maxOrdersPerDay: defaultMaxOrders,
      leadTimeDays,
      blockedDates,
    },
    availability,
  };
}

/** Availability of one specific date — used to validate incoming aanvragen. */
export async function getDayAvailability(date: string): Promise<DayAvailability | undefined> {
  const { availability } = await getAvailability(date, date);
  return availability[0];
}
