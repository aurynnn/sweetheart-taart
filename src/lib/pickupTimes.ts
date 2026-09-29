// src/lib/pickupTimes.ts — Which ophaalmomenten are offered on which day.
//
// Resolution order for a date:  specific date  →  weekday  →  general default.
// An empty list means "no pickups that day" (the date becomes unavailable).
// Stored as JSON in app_settings['pickup_times'], so no migration is needed.

import { d1Query } from './d1';
import { PICKUP_TIMES } from './catalog';

export interface PickupConfig {
  /** Used for every day without a weekday or date override */
  default: string[];
  /** Keys "0" (zondag) … "6" (zaterdag) */
  weekdays: Record<string, string[]>;
  /** Keys "YYYY-MM-DD" */
  dates: Record<string, string[]>;
}

const KEY = 'pickup_times';
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_CONFIG: PickupConfig = { default: [...PICKUP_TIMES], weekdays: {}, dates: {} };

let cache: { at: number; config: PickupConfig } | null = null;

function cleanTimes(list: unknown): string[] | null {
  if (!Array.isArray(list)) return null;
  const times = [...new Set(list.filter((t): t is string => typeof t === 'string' && TIME_RE.test(t)))].sort();
  return times.slice(0, 24);
}

/** Validates and normalises a config coming from the admin UI. Throws on bad input. */
export function normalizeConfig(input: any, todayIso?: string): PickupConfig {
  const def = cleanTimes(input?.default);
  if (!def) throw new Error('Ongeldige standaard ophaalmomenten');
  const weekdays: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(input?.weekdays ?? {})) {
    const times = cleanTimes(v);
    if (/^[0-6]$/.test(k) && times) weekdays[k] = times;
  }
  const dates: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(input?.dates ?? {})) {
    const times = cleanTimes(v);
    // Drop overrides for dates that have passed
    if (DATE_RE.test(k) && times && (!todayIso || k >= todayIso)) dates[k] = times;
  }
  return { default: def, weekdays, dates };
}

export async function getPickupConfig(): Promise<PickupConfig> {
  if (cache && Date.now() - cache.at < 30_000) return cache.config;
  let config = DEFAULT_CONFIG;
  try {
    const res = await d1Query('SELECT value FROM app_settings WHERE key = ?', [KEY]);
    const raw = res.results?.[0]?.value as string | undefined;
    if (raw) config = normalizeConfig(JSON.parse(raw));
  } catch (err) {
    console.warn('[pickupTimes] using defaults:', (err as Error).message);
  }
  cache = { at: Date.now(), config };
  return config;
}

export async function savePickupConfig(config: PickupConfig): Promise<void> {
  await d1Query('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [KEY, JSON.stringify(config)]);
  cache = { at: Date.now(), config };
}

export function timesForDate(config: PickupConfig, iso: string): string[] {
  if (config.dates[iso]) return config.dates[iso];
  const dow = String(new Date(iso + 'T00:00:00').getDay());
  return config.weekdays[dow] ?? config.default;
}
