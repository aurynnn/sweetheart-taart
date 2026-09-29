// src/lib/tokens.ts — Signed, tamper-proof link tokens (HMAC-SHA256).
// Used for links in e-mails (rating, reminders, unsubscribe, "plan je volgende taart"),
// so links carry an id + signature instead of personal data like an e-mail address.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env';

export type TokenPurpose = 'review' | 'customer' | 'reminder' | 'optout';

function secret(): string {
  // APP_SECRET is preferred; otherwise derive a stable secret from an existing server-only key
  return env('APP_SECRET') || createHash('sha256').update(`links:${env('CLOUDFLARE_API_TOKEN') ?? 'dev'}`).digest('hex');
}

export function signToken(purpose: TokenPurpose, id: string): string {
  return createHmac('sha256', secret()).update(`${purpose}:${id}`).digest('base64url').slice(0, 24);
}

export function verifyToken(purpose: TokenPurpose, id: string, token: string | null | undefined): boolean {
  if (!id || !token) return false;
  const expected = Buffer.from(signToken(purpose, id));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
