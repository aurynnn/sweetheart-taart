// src/lib/rateLimit.ts — Cloudflare's built-in rate limiter (bindings in wrangler.toml).
// Counts per IP across all Worker instances in a location, unlike an in-memory Map.
// Missing binding (e.g. a plain Node run) → never blocks.

import { env } from 'cloudflare:workers';
import { normalizePath } from './auth';

type Limiter = { limit(opts: { key: string }): Promise<{ success: boolean }> };
export type LimiterName = 'LOGIN_LIMITER' | 'FORM_LIMITER';

export async function withinLimit(name: LimiterName, key: string): Promise<boolean> {
  const limiter = (env as Record<string, unknown>)[name] as Limiter | undefined;
  if (!limiter) return true;
  try {
    return (await limiter.limit({ key })).success;
  } catch {
    return true;
  }
}

/** Public endpoints that write something; each gets its own budget per IP */
export function limiterFor(rawPath: string, method: string): LimiterName | null {
  if (method !== 'POST') return null;
  const pathname = normalizePath(rawPath);
  if (pathname === '/admin/login') return 'LOGIN_LIMITER';
  if (['/api/orders', '/api/reminders', '/api/feedback', '/api/uploads'].includes(pathname)) return 'FORM_LIMITER';
  return null;
}
