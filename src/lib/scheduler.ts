// src/lib/scheduler.ts — Background jobs inside the Node server.
//
// Every hour (mails only between 09:00 and 20:00):
//   - review requests: orders picked up yesterday (up to a week ago) get "hoe was het?" — once
//   - reminders: "over een maand is het …" mails whose remind date has come
// Once a day: retention clean-up (old example photos, long-inactive customers)
//
// Runs in production by default. REVIEW_SCHEDULER=false switches it off,
// REVIEW_SCHEDULER=true switches it on in development too.

import { env } from './env';
import { dueReviewOrderIds } from './reviews';
import { sendReviewRequest, sendDueReminders } from './email';
import { purgeOldPhotos, purgeInactiveCustomers } from './retention';

const HOUR = 60 * 60_000;
let started = false;
let lastCleanup = '';

/** GDPR storage limitation, once a day (see lib/retention.ts) */
async function dailyCleanup() {
  const today = new Date().toISOString().slice(0, 10);
  if (lastCleanup === today) return;
  lastCleanup = today;
  try {
    const photos = await purgeOldPhotos();
    const customers = await purgeInactiveCustomers();
    if (photos || customers) console.info(`[scheduler] retention: ${photos} photo(s) deleted, ${customers} customer(s) anonymised`);
  } catch (err) {
    console.error('[scheduler] retention cleanup failed:', err);
  }
}

function enabled(): boolean {
  const flag = env('REVIEW_SCHEDULER');
  if (flag === 'false') return false;
  return flag === 'true' || import.meta.env.PROD;
}

async function runHourlyJobs() {
  await dailyCleanup();
  const hour = new Date().getHours();
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

export function startScheduler() {
  if (started) return;
  started = true;
  if (!enabled()) {
    console.info('[scheduler] disabled (set REVIEW_SCHEDULER=true to enable outside production)');
    return;
  }
  console.info('[scheduler] started — review requests and reminders are checked every hour');
  setTimeout(runHourlyJobs, 60_000);
  setInterval(runHourlyJobs, HOUR).unref?.();
}
