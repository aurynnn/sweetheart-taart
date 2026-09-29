/**
 * D1 REST API client for use with Node.js SSR (not Cloudflare Workers runtime).
 * Uses the Cloudflare API token to query D1 via the REST API.
 */

import { env } from './env';

interface D1Result {
  results: any[];
  success: boolean;
  meta?: any;
}

interface D1Response {
  result: any[];
  success: boolean;
  errors?: any[];
  messages?: any[];
}

function getD1Config() {
  return {
    ACCOUNT_ID: env('CF_ACCOUNT_ID', '0c208fec72117fa28deae09152d2abe2'),
    DATABASE_ID: env('D1_DATABASE_ID', 'd4378307-5a1d-46b1-9c74-7097551a5006'),
    API_TOKEN: env('CLOUDFLARE_API_TOKEN'),
  };
}

export async function d1Query(sql: string, bindings: any[] = []): Promise<D1Result> {
  const { ACCOUNT_ID, DATABASE_ID, API_TOKEN } = getD1Config();
  if (!API_TOKEN) {
    throw new Error('CLOUDFLARE_API_TOKEN not set');
  }

  const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}`;
  const res = await fetch(`${BASE_URL}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql,
      params: bindings,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`D1 API error ${res.status}: ${text}`);
  }

  const data: D1Response = await res.json();

  if (!data.success) {
    throw new Error(`D1 query failed: ${JSON.stringify(data.errors)}`);
  }

  // D1 REST API wraps results in data.result[0].results
  const rows = Array.isArray(data.result) && data.result.length > 0
    ? (data.result[0].results || [])
    : (data.result || []);

  return {
    results: rows,
    success: true,
  };
}

export async function d1Exec(sql: string): Promise<{ success: boolean; meta?: any }> {
  const { ACCOUNT_ID, DATABASE_ID, API_TOKEN } = getD1Config();
  if (!API_TOKEN) {
    throw new Error('CLOUDFLARE_API_TOKEN not set');
  }

  const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}`;
  const res = await fetch(`${BASE_URL}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`D1 API error ${res.status}: ${text}`);
  }

  const data: D1Response = await res.json();
  return { success: data.success, meta: data };
}
