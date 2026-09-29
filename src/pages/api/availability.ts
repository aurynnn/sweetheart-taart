import type { APIRoute } from 'astro';
import { d1Query } from '../../lib/d1';
import { getAvailability } from '../../lib/availability';

export const GET: APIRoute = async ({ url }) => {
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if ((startDate && !isoDate.test(startDate)) || (endDate && !isoDate.test(endDate))) {
    return new Response(JSON.stringify({ error: 'Invalid date format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await getAvailability(startDate, endDate);

  return new Response(JSON.stringify(result), {
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
