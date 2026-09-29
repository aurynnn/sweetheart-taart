// src/lib/env.ts — Server-side env lookup for the Node SSR runtime.
// Reads process.env first, then the project's .env file (bypassing Vite's
// env handling, which does not expose non-PUBLIC_ vars to SSR code reliably).

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let fileVars: Record<string, string> | null = null;

function loadEnvFile(): Record<string, string> {
  if (fileVars) return fileVars;
  fileVars = {};
  const candidates = [
    join(process.cwd(), '.env'),
    join(dirname(fileURLToPath(import.meta.url)), '../../.env'),
    join(dirname(fileURLToPath(import.meta.url)), '.env'),
  ];
  const path = candidates.find((p) => existsSync(p));
  if (!path) return fileVars;
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    fileVars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return fileVars;
}

export function env(key: string, fallback?: string): string | undefined {
  return process.env[key] || loadEnvFile()[key] || fallback;
}
