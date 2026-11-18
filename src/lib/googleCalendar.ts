// src/lib/googleCalendar.ts — Direct Google koppeling (optional, needs OAuth keys).
// Without keys the admin offers the subscription feed instead (lib/calendarFeed.ts),
// which needs no setup but is refreshed by Google only a few times a day.
//
// Connecting (Admin → Beschikbaarheid → "Verbinden") creates a separate calendar
// "Sweetheart bestellingen" in her Google account, so orders never mix with private
// appointments and the whole calendar can be shown/hidden or coloured in one click.
// Each order becomes one event at the pickup moment; it is rewritten whenever the
// order changes (new → aanvraag, bevestigd, opgehaald) and removed when cancelled.
//
// Event ids are derived from the order id, so there is no mapping table: syncing the
// same order twice simply updates the same event.
//
// Setup (once, by the developer): a Google Cloud OAuth client ("Web application") with
// redirect URI https://<site>/admin/api/calendar/callback, and GOOGLE_CLIENT_ID /
// GOOGLE_CLIENT_SECRET as Worker secrets. Publish the OAuth consent screen ("In production"),
// otherwise Google expires the connection after 7 days.

import { d1Query } from './d1';
import { env } from './env';
import { TIME_ZONE, todayIso, addDays } from './dates';
import { SITE } from '../config/site';
import { getOrder, listOrders, type FullOrder } from './orderRepo';
import { orderEvent, EVENT_STATUS, CALENDAR_NAME } from './orderEvent';

const KEY = 'google_calendar';
const API = 'https://www.googleapis.com/calendar/v3';
// Only calendars this app creates (not her private agenda) + her address for the admin card
const SCOPES = ['https://www.googleapis.com/auth/calendar.app.created', 'email'].join(' ');

export interface CalendarConnection {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
  email?: string;
  calendarId: string;
  connectedAt: string;
  lastSyncAt?: string;
  /** Last failure, shown in the admin until a sync succeeds again */
  lastError?: string;
}

const clientId = () => env('GOOGLE_CLIENT_ID') ?? '';
const clientSecret = () => env('GOOGLE_CLIENT_SECRET') ?? '';

export const googleConfigured = () => !!clientId() && !!clientSecret();

export function redirectUri(origin: string): string {
  return env('GOOGLE_REDIRECT_URI') || `${origin.replace(/\/$/, '')}/admin/api/calendar/callback`;
}

export function getAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(origin),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ── Stored connection (app_settings, like the e-mail settings) ────────────

export async function getConnection(): Promise<CalendarConnection | null> {
  try {
    const res = await d1Query('SELECT value FROM app_settings WHERE key = ?', [KEY]);
    const raw = res.results?.[0]?.value as string | undefined;
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('[googleCalendar] could not read connection:', (err as Error).message);
    return null;
  }
}

async function saveConnection(conn: CalendarConnection): Promise<void> {
  await d1Query('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [KEY, JSON.stringify(conn)]);
}

async function tokenRequest(params: Record<string, string>): Promise<any> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), ...params }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.error || `Google token error ${res.status}`);
  return data;
}

/** OAuth callback: store the tokens and make sure the orders calendar exists */
export async function connect(code: string, origin: string): Promise<CalendarConnection> {
  const tokens = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: redirectUri(origin) });
  if (!tokens.refresh_token) throw new Error('Google gaf geen refresh token terug');

  const accessToken = tokens.access_token as string;
  const info: any = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));

  // Reconnecting with the same account keeps the existing calendar (and its colour)
  const previous = await getConnection();
  let calendarId = previous && (!previous.email || previous.email === info.email) ? previous.calendarId : '';
  if (calendarId) {
    const check = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!check.ok) calendarId = '';
  }
  if (!calendarId) {
    const res = await fetch(`${API}/calendars`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: CALENDAR_NAME, description: `Aanvragen en bestellingen van ${SITE.url}`, timeZone: TIME_ZONE }),
    });
    if (!res.ok) throw new Error(`Agenda aanmaken mislukt (${res.status})`);
    calendarId = ((await res.json()) as any).id;
    // Pink, like the site, so orders stand out between other calendars
    await fetch(`${API}/users/me/calendarList/${encodeURIComponent(calendarId)}?colorRgbFormat=true`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ backgroundColor: '#d45a6a', foregroundColor: '#ffffff' }),
    }).catch(() => {});
  }

  const conn: CalendarConnection = {
    refreshToken: tokens.refresh_token,
    accessToken,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    email: info.email,
    calendarId,
    connectedAt: new Date().toISOString(),
  };
  await saveConnection(conn);
  return conn;
}

/** Revoke at Google and forget the tokens. The calendar itself stays in her account. */
export async function disconnect(): Promise<void> {
  const conn = await getConnection();
  if (conn) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(conn.refreshToken)}`, { method: 'POST' }).catch(() => {});
  }
  await d1Query('DELETE FROM app_settings WHERE key = ?', [KEY]);
}

async function accessToken(conn: CalendarConnection): Promise<string> {
  if (conn.accessToken && conn.expiresAt && conn.expiresAt - 60_000 > Date.now()) return conn.accessToken;
  const tokens = await tokenRequest({ refresh_token: conn.refreshToken, grant_type: 'refresh_token' });
  conn.accessToken = tokens.access_token;
  conn.expiresAt = Date.now() + (tokens.expires_in ?? 3600) * 1000;
  await saveConnection(conn);
  return conn.accessToken!;
}

// ── Orders → events ────────────────────────────────────────────────────────

/** Google event ids must be base32hex (0-9, a-v); encoding the order id keeps them stable */
function eventId(orderId: string): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuv';
  let bits = '';
  for (const byte of new TextEncoder().encode(orderId)) bits += byte.toString(2).padStart(8, '0');
  let out = 'sh';
  for (let i = 0; i < bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out;
}

function buildEvent(order: FullOrder) {
  const e = orderEvent(order);
  const [start, end] = e.time
    ? [{ dateTime: `${e.date}T${e.time}:00`, timeZone: TIME_ZONE }, { dateTime: `${e.endDate}T${e.endTime}:00`, timeZone: TIME_ZONE }]
    : [{ date: e.date }, { date: e.endDate }];
  return {
    summary: e.title,
    description: e.description,
    location: e.location,
    start, end,
    colorId: EVENT_STATUS[e.status].googleColor,
    status: 'confirmed',
    // Open requests don't block her agenda yet; confirmed orders do
    transparency: e.status === 'pending' ? 'transparent' : 'opaque',
    reminders: { useDefault: false, overrides: e.alarms.map((minutes) => ({ method: 'popup', minutes })) },
    source: { title: 'Sweetheart dashboard', url: e.url },
    extendedProperties: { private: { orderId: order.id } },
  };
}

async function calendarFetch(conn: CalendarConnection, path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken(conn);
  return fetch(`${API}/calendars/${encodeURIComponent(conn.calendarId)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

async function writeOrder(conn: CalendarConnection, orderId: string, order: FullOrder | null): Promise<void> {
  const id = eventId(orderId);
  if (!order || order.status === 'cancelled') {
    const res = await calendarFetch(conn, `/events/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Event verwijderen mislukt (${res.status})`);
    return;
  }
  const body = JSON.stringify(buildEvent(order));
  // Update first; a never-synced order falls through to insert with our own id
  let res = await calendarFetch(conn, `/events/${id}`, { method: 'PUT', body });
  if (res.status === 404) res = await calendarFetch(conn, '/events', { method: 'POST', body: JSON.stringify({ id, ...JSON.parse(body) }) });
  if (!res.ok) throw new Error(`Agenda bijwerken mislukt (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

async function recordResult(conn: CalendarConnection, error?: unknown) {
  conn.lastSyncAt = new Date().toISOString();
  conn.lastError = error ? (error as Error).message?.slice(0, 300) || String(error) : undefined;
  await saveConnection(conn).catch(() => {});
}

/** Create, update or remove the event for one order. Never throws: the order itself must not fail on Google. */
export async function syncOrder(orderId: string): Promise<void> {
  const conn = await getConnection();
  if (!conn || !googleConfigured()) return;
  try {
    await writeOrder(conn, orderId, await getOrder(orderId));
    if (conn.lastError) await recordResult(conn);
  } catch (err) {
    console.error('[googleCalendar] sync failed for', orderId, err);
    await recordResult(conn, err);
  }
}

/** Remove events (e.g. after a GDPR erase) */
export async function removeOrderEvents(orderIds: string[]): Promise<void> {
  const conn = await getConnection();
  if (!conn || !googleConfigured()) return;
  for (const id of orderIds) await writeOrder(conn, id, null).catch((err) => console.error('[googleCalendar] remove failed', id, err));
}

/** Put every order from the last week onward in the agenda (after connecting, or via "Nu synchroniseren") */
export async function syncUpcomingOrders(): Promise<{ synced: number; failed: number }> {
  const conn = await getConnection();
  if (!conn || !googleConfigured()) return { synced: 0, failed: 0 };
  const orders = await listOrders({ dateFrom: addDays(todayIso(), -7) });
  let synced = 0, failed = 0, lastErr: unknown;
  for (const order of orders) {
    try { await writeOrder(conn, order.id, order); synced++; }
    catch (err) { failed++; lastErr = err; }
  }
  await recordResult(conn, failed ? lastErr : undefined);
  return { synced, failed };
}
