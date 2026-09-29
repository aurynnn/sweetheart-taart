// src/lib/schema.ts — Lets queries adapt to which migrations have been applied.
// The remote D1 database is migrated by hand (wrangler d1 execute ...), so code
// must keep working before and after e.g. migrations/0005 and 0006 are run.

import { d1Query } from './d1';

const cache = new Map<string, { at: number; columns: Set<string> }>();
const TTL_MS = 60_000;

export async function tableColumns(table: string): Promise<Set<string>> {
  if (!/^[a-z_]+$/.test(table)) throw new Error(`Invalid table name: ${table}`);
  const hit = cache.get(table);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.columns;
  const res = await d1Query(`PRAGMA table_info(${table})`);
  const columns = new Set<string>((res.results || []).map((r: any) => String(r.name)));
  cache.set(table, { at: Date.now(), columns });
  return columns;
}

/** SQL expression for a customer's full name that works with and without firstname/lastname columns. */
export async function customerNameSql(alias = 'c'): Promise<{ first: string; last: string; full: string }> {
  const cols = await tableColumns('customers');
  if (cols.has('firstname') && cols.has('lastname')) {
    const first = `COALESCE(NULLIF(${alias}.firstname, ''), ${cols.has('name') ? `${alias}.name` : "''"})`;
    const last = `COALESCE(${alias}.lastname, '')`;
    return { first, last, full: `TRIM(${first} || ' ' || ${last})` };
  }
  return { first: `${alias}.name`, last: "''", full: `${alias}.name` };
}
