// src/lib/env.ts — Server-side env lookup for the Node SSR runtime.
// Reads process.env first, then the project's .env file (bypassing Vite's
// env handling, which does not expose non-PUBLIC_ vars to SSR code reliably).
// The .env file is re-read when it changes, so new keys work without a restart.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let cache: { path: string; mtimeMs: number; vars: Record<string, string> } | null = null;

function envPath(): string | undefined {
  const candidates = [
    join(process.cwd(), '.env'),
    join(dirname(fileURLToPath(import.meta.url)), '../../.env'),
    join(dirname(fileURLToPath(import.meta.url)), '.env'),
  ];
  return candidates.find((p) => existsSync(p));
}

function loadEnvFile(): Record<string, string> {
  const path = envPath();
  if (!path) return {};
  const mtimeMs = statSync(path).mtimeMs;
  if (cache && cache.path === path && cache.mtimeMs === mtimeMs) return cache.vars;

  const vars: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  cache = { path, mtimeMs, vars };
  return vars;
}

export function env(key: string, fallback?: string): string | undefined {
  return process.env[key] || loadEnvFile()[key] || fallback;
}
