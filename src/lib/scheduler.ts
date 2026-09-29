// src/lib/scheduler.ts — Background jobs, run by the Worker's hourly cron trigger
// (wrangler.toml → src/worker.ts).
//
// Every hour (mails only between 09:00 and 20:00 Belgian time):
//   - review requests: orders picked up yesterday (up to a week ago) get "hoe was het?" — once
//   - reminders: "over een maand is het …" mails whose remind date has come
// Once a day, at 03:00: retention clean-up (old example photos, long-inactive customers)
//
// REVIEW_SCHEDULER=false switches the jobs off.

import { belgianHour } from './dates';
import { env } from './env';
import { dueReviewOrderIds } from './reviews';
import { sendReviewRequest, sendDueReminders } from './email';
import { purgeOldPhotos, purgeInactiveCustomers } from './retention';

const CLEANUP_HOUR = 3;

/** GDPR storage limitation, once a day (see lib/retention.ts) */
async function dailyCleanup() {
  try {
    const photos = await purgeOldPhotos();
    const customers = await purgeInactiveCustomers();
    if (photos || customers) console.info(`[scheduler] retention: ${photos} photo(s) deleted, ${customers} customer(s) anonymised`);
  } catch (err) {
    console.error('[scheduler] retention cleanup failed:', err);
  }
}

export async function runScheduledJobs() {
  if (env('REVIEW_SCHEDULER') === 'false') {
    console.info('[scheduler] disabled (REVIEW_SCHEDULER=false)');
    return;
  }
  const hour = belgianHour();
  if (hour === CLEANUP_HOUR) await dailyCleanup();
  if (hour < 9 || hour >= 20) return;
  try {
    const ids = await dueReviewOrderIds();
    for (const id of ids) {
      await sendReviewRequest(id); // sequential: gentle on the mail provider
    }
    if (ids.length) console.info(`[scheduler] review requests processed: ${ids.join(', ')}`);
  } catch (err) {
    console.error('[scheduler] review requests failed:', err);
  }
  try {
    const sent = await sendDueReminders();
    if (sent) console.info(`[scheduler] reminders sent: ${sent}`);
  } catch (err) {
    console.error('[scheduler] reminders failed:', err);
  }
}
