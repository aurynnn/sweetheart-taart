import type { APIRoute } from 'astro';
import { d1Query } from '../../lib/d1';

export const GET: APIRoute = async ({ url }) => {
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');

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

  const availability: Array<{
    date: string;
    available: boolean;
    orders: number;
    maxOrders: number;
    remaining: number;
    reason?: string;
  }> = [];

  const dayNames = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];

  // Build YYYY-MM-DD in local time (not UTC) to match frontend date strings and avoid off-by-one
  function toLocalDateStr(d: Date) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

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
          ? `Bestel minstens ${leadTimeDays} dag${leadTimeDays === 1 ? '' : 'en'} van tevoren`
          : 'Datum is voorbij';
      } else if (isPast) {
        isAvailable = false;
        reason = 'Datum is voorbij';
      } else if (isRecurringUnavailable) {
        isAvailable = false;
        reason = `Elke ${dayNames[dayOfWeek]} gesloten`;
      } else if (ordersCount >= maxOrders) {
        isAvailable = false;
        reason = 'Volledig bezet';
      } else if (!isRecurringAvailable) {
        isAvailable = false;
        reason = `Elke ${dayNames[dayOfWeek]} gesloten`;
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

  const settings = {
    recurringUnavailableDays: recurringUnavailable,
    availableDays: recurringAvailable,
    maxOrdersPerDay: defaultMaxOrders,
    leadTimeDays,
    blockedDates,
  };

  return new Response(JSON.stringify({ settings, availability }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { maxOrdersPerDay, availableDays, recurringUnavailableDays, blockedDates, newBlockedDates, removedBlockedDates, slotOverrides, leadTimeDays } = body;

    // Save lead_time_days
    try {
      await d1Query(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('lead_time_days', ?)",
        [String(leadTimeDays ?? 0)]
      );
    } catch { /* table may not exist */ }

    const allDays = [0, 1, 2, 3, 4, 5, 6];
    const available = availableDays ?? [1, 2, 3, 4, 5, 6];
    const unavailable = recurringUnavailableDays ?? [0];

    // Sync recurring_schedule: upsert each day
    for (const day of allDays) {
      const isEnabled = available.includes(day) ? 1 : 0;
      // Check if day exists in table
      const existing = await d1Query(
        'SELECT day_of_week FROM recurring_schedule WHERE day_of_week = ?',
        [day]
      );
      if (existing.results?.length > 0) {
        await d1Query(
          'UPDATE recurring_schedule SET enabled = ?, max_orders = ? WHERE day_of_week = ?',
          [isEnabled, maxOrdersPerDay ?? 3, day]
        );
      } else {
        await d1Query(
          'INSERT INTO recurring_schedule (day_of_week, enabled, max_orders) VALUES (?, ?, ?)',
          [day, isEnabled, maxOrdersPerDay ?? 3]
        );
      }
    }

    // Clear removed blocked dates from D1
    for (const date of removedBlockedDates ?? []) {
      await d1Query("DELETE FROM availability_days WHERE date = ? AND mode = 'geblokkeerd'", [date]);
    }

    // Upsert new blocked dates (skip those already in DB)
    const existingBlocked = await d1Query(
      "SELECT date FROM availability_days WHERE mode = 'geblokkeerd'"
    );
    const existingBlockedSet = new Set((existingBlocked.results ?? []).map((r: any) => r.date as string));

    for (const blocked of blockedDates ?? []) {
      if (!existingBlockedSet.has(blocked.date)) {
        await d1Query(
          "INSERT INTO availability_days (date, mode, max_orders, reason) VALUES (?, 'geblokkeerd', ?, ?)",
          [blocked.date, maxOrdersPerDay ?? 3, blocked.reason ?? null]
        );
      }
    }

    // Also handle legacy newBlockedDates format (array of date strings)
    for (const date of newBlockedDates ?? []) {
      if (typeof date === 'string' && !existingBlockedSet.has(date)) {
        await d1Query(
          "INSERT INTO availability_days (date, mode, max_orders, reason) VALUES (?, 'geblokkeerd', ?, ?)",
          [date, maxOrdersPerDay ?? 3, null]
        );
      }
    }

    // Sync slot overrides
    for (const [date, override] of Object.entries<any>(slotOverrides ?? {})) {
      await d1Query('DELETE FROM availability_days WHERE date = ?', [date]);
      await d1Query(
        'INSERT INTO availability_days (date, mode, max_orders, reason) VALUES (?, ?, ?, ?)',
        [date, override.mode, override.orders ?? maxOrdersPerDay ?? 3, override.reason ?? null]
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
