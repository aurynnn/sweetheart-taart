// src/worker.ts — Cloudflare Worker entry: Astro handles the requests,
// the hourly cron trigger (wrangler.toml) runs the background jobs.
import { handle } from '@astrojs/cloudflare/handler';
import { runScheduledJobs } from './lib/scheduler';

export default {
  fetch: handle,
  async scheduled(_controller: unknown, _env: unknown, ctx: { waitUntil(promise: Promise<unknown>): void }) {
    ctx.waitUntil(runScheduledJobs());
  },
};
