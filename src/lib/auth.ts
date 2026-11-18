// src/lib/auth.ts — Admin login.
//
// Credentials come from .env (ADMIN_USERNAME / ADMIN_PASSWORD). After a successful
// login the browser gets a signed, HttpOnly session cookie; nothing is stored server-side.
// Fails closed: without credentials in .env nobody can log in.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { env } from './env';
import { d1Query } from './d1';

export const SESSION_COOKIE = 'sh_admin';
const SESSION_HOURS = 12;

// ── Brute-force protection: max 5 failed attempts per IP per 15 minutes ──
// Stored in D1 so the count holds across all Worker instances; the Map is the fallback
// when the database can't be reached.
const WINDOW_MS = 15 * 60_000;
const MAX_FAILS = 5;
const fails = new Map<string, number[]>();
let tableReady = false;

async function failuresTable(): Promise<void> {
  if (tableReady) return;
  await d1Query('CREATE TABLE IF NOT EXISTS login_failures (ip TEXT NOT NULL, at INTEGER NOT NULL)');
  await d1Query('CREATE INDEX IF NOT EXISTS idx_login_failures_ip ON login_failures (ip, at)');
  tableReady = true;
}

function memoryCount(ip: string): number {
  const recent = (fails.get(ip) ?? []).filter((t) => Date.now() - t < WINDOW_MS);
  fails.set(ip, recent);
  return recent.length;
}

export async function isLockedOut(ip: string): Promise<boolean> {
  try {
    await failuresTable();
    const res = await d1Query('SELECT COUNT(*) as n FROM login_failures WHERE ip = ? AND at > ?', [ip, Date.now() - WINDOW_MS]);
    return Number(res.results?.[0]?.n ?? 0) >= MAX_FAILS;
  } catch {
    return memoryCount(ip) >= MAX_FAILS;
  }
}

export async function registerFailure(ip: string): Promise<void> {
  fails.set(ip, [...(fails.get(ip) ?? []), Date.now()]);
  try {
    await failuresTable();
    await d1Query('INSERT INTO login_failures (ip, at) VALUES (?, ?)', [ip, Date.now()]);
    await d1Query('DELETE FROM login_failures WHERE at < ?', [Date.now() - 24 * 3600_000]);
  } catch { /* memory fallback already counted it */ }
}

export async function clearFailures(ip: string): Promise<void> {
  fails.delete(ip);
  try { await d1Query('DELETE FROM login_failures WHERE ip = ?', [ip]); } catch { /* ignore */ }
}

export function credentialsConfigured(): boolean {
  return !!env('ADMIN_USERNAME') && !!env('ADMIN_PASSWORD');
}

/** Constant-time comparison (hashing first makes lengths equal) */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkCredentials(username: string, password: string): boolean {
  const u = env('ADMIN_USERNAME');
  const p = env('ADMIN_PASSWORD');
  if (!u || !p) return false;
  // Evaluate both, so timing doesn't reveal which one was wrong
  const userOk = safeEqual(username.trim().toLowerCase(), u.toLowerCase());
  const passOk = safeEqual(password, p);
  return userOk && passOk;
}

function secret(): string {
  // Changing ADMIN_PASSWORD invalidates all existing sessions
  const base = env('APP_SECRET') || env('CLOUDFLARE_API_TOKEN') || 'dev';
  return createHash('sha256').update(`session:${base}:${env('ADMIN_PASSWORD') ?? ''}`).digest('hex');
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function createSessionValue(username: string): string {
  const expires = Date.now() + SESSION_HOURS * 3600_000;
  const payload = `${Buffer.from(username).toString('base64url')}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function readSession(value: string | undefined): { username: string } | null {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [user, expires, sig] = parts;
  const expected = Buffer.from(sign(`${user}.${expires}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!(Number(expires) > Date.now())) return null;
  return { username: Buffer.from(user, 'base64url').toString() };
}

export function setSessionCookie(cookies: AstroCookies, username: string, secure: boolean) {
  cookies.set(SESSION_COOKIE, createSessionValue(username), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: SESSION_HOURS * 3600,
  });
}

export function clearSessionCookie(cookies: AstroCookies) {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

/** HTTPS directly or behind a proxy/tunnel (Cloudflare sets x-forwarded-proto) */
export function isSecureRequest(request: Request, url: URL): boolean {
  return url.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
}

/** Which requests need a logged-in admin */
export function requiresAdmin(pathname: string, method: string): boolean {
  if (pathname === '/admin/login' || pathname === '/admin/logout') return false;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true;
  // Order data and status changes; placing an aanvraag (POST) stays public
  if (pathname === '/api/orders' || pathname.startsWith('/api/orders/')) return method !== 'POST';
  // Reading availability is public (calendar); changing it is admin-only
  if (pathname === '/api/availability') return method !== 'GET';
  return false;
}

/**
 * The visitor's IP for rate limiting. Cloudflare's `cf-connecting-ip` header is only
 * trusted when the request arrives via the local tunnel (loopback); otherwise anyone
 * could send a fake header to dodge the limits.
 */
export function clientIp(request: Request, clientAddress: string | undefined): string {
  const direct = clientAddress || 'unknown';
  const viaLocalTunnel = /^(127\.|::1$|::ffff:127\.)/.test(direct);
  return (viaLocalTunnel && request.headers.get('cf-connecting-ip')) || direct;
}
