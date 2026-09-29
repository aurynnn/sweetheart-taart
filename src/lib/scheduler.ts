// src/lib/scheduler.ts — Background jobs inside the Node server.
//
// Review requests: every hour, orders picked up yesterday (up to a week ago) get
// the "hoe was het?" mail — once. Mails only go out between 09:00 and 20:00.
//
// Runs in production by default. REVIEW_SCHEDULER=false switches it off,
// REVIEW_SCHEDULER=true switches it on in development too.

import { env } from './env';
import { dueReviewOrderIds } from './reviews';
import { sendReviewRequest } from './email';

const HOUR = 60 * 60_000;
let started = false;

function enabled(): boolean {
  const flag = env('REVIEW_SCHEDULER');
  if (flag === 'false') return false;
  return flag === 'true' || import.meta.env.PROD;
}

async function sendDueReviewRequests() {
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
}

export function startScheduler() {
  if (started) return;
  started = true;
  if (!enabled()) {
    console.info('[scheduler] disabled (set REVIEW_SCHEDULER=true to enable outside production)');
    return;
  }
  console.info('[scheduler] started — review requests are checked every hour');
  setTimeout(sendDueReviewRequests, 60_000);
  setInterval(sendDueReviewRequests, HOUR).unref?.();
}
