// src/lib/env.ts — Server-side env lookup.
// On Cloudflare the Worker's vars and secrets (dashboard / `wrangler secret put`)
// are exposed on process.env by the nodejs_compat flag. In local dev
// (`astro dev` runs in workerd too) they come from `.env` or `.dev.vars`.
// Dates never depend on the server's timezone: see lib/dates.ts (Europe/Brussels).

export function env(key: string, fallback?: string): string | undefined {
  return process.env[key] || fallback;
}
