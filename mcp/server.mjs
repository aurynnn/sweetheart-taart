#!/usr/bin/env node
// mcp/server.mjs — MCP server (stdio) that lets an agent test the Sweetheart website.
//
// Read-only by default: pages, links, SEO, security headers, admin protection, the
// catalog, price quotes and availability. Nothing is written anywhere.
//
// Placing a real aanvraag is OFF unless SWEETHEART_MCP_ALLOW_ORDERS=1. Careful: the local
// dev server uses the LIVE D1 database and sends real e-mails (unless MAIL_ENABLED=false),
// so a test order shows up in the admin. Test orders are tagged "[MCP TEST]".
//
// Env:
//   SWEETHEART_BASE_URL          site to test (default http://localhost:4321 = `npm run dev`)
//   SWEETHEART_MCP_ALLOW_ORDERS  "1" enables submit_order
//   SWEETHEART_MCP_ALLOW_REMOTE  "1" also allows submit_order against a non-local site
//
// No dependencies: speaks MCP's JSON-RPC over stdio directly. Needs Node ≥ 23.6 (imports
// the site's own catalog.ts, so quotes always match the website).

import { createInterface } from 'node:readline';
import {
  PRODUCTS, EVENTS, CAKE_SIZES, CAKE_FLAVORS, FLAVOR_CATEGORIES, FLAVORS, TOPPERS, MINI_TYPES,
  KOEKJES_QTY, MINI_MAX, MAX_ITEMS, PICKUP_TIMES, itemPrice, itemDeposit, itemSummary, validateItem,
  EMAIL_RE, isValidPhone,
} from '../src/lib/catalog.ts';

const BASE = (process.env.SWEETHEART_BASE_URL || 'http://localhost:4321').replace(/\/+$/, '');
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(BASE);
const ORDERS_ON = process.env.SWEETHEART_MCP_ALLOW_ORDERS === '1' && (IS_LOCAL || process.env.SWEETHEART_MCP_ALLOW_REMOTE === '1');
const ORIGIN = new URL(BASE).origin;

const PUBLIC_PAGES = ['/', '/feestcollectie', '/koekjescollectie', '/mini-collectie', '/aanvraag', '/volgende-taart', '/tips', '/privacy', '/algemene-voorwaarden', '/herinnering', '/beoordeling', '/uitschrijven'];
const SECURITY_HEADERS = ['x-content-type-options', 'x-frame-options', 'content-security-policy', 'referrer-policy', 'permissions-policy'];
// Routes that must refuse visitors who are not logged in
const PROTECTED = [
  { path: '/admin', method: 'GET' }, { path: '/admin/orders', method: 'GET' }, { path: '/admin/api/print', method: 'GET' },
  { path: '/api/orders', method: 'GET' }, { path: '/api/availability', method: 'PUT' }, { path: '/admin/api/pickup-times', method: 'PUT' },
];

// ── HTTP helpers ─────────────────────────────────────────────────────────
async function fetchText(path, init = {}) {
  const res = await fetch(BASE + path, { redirect: 'manual', ...init, headers: { 'User-Agent': 'sweetheart-test-mcp', ...(init.headers || {}) } });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text, location: res.headers.get('location') };
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const pick = (re, html) => { const m = html.match(re); return m ? decode(m[1].trim()) : null; };

function analyse(html) {
  const links = new Set();
  for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) links.add(m[1]);
  for (const m of html.matchAll(/srcset="([^"]*)"/g)) for (const part of m[1].split(',')) { const u = part.trim().split(' ')[0]; if (u.startsWith('/')) links.add(u); }
  const ids = {};
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids[m[1]] = (ids[m[1]] || 0) + 1;
  const text = decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  return {
    title: pick(/<title>([\s\S]*?)<\/title>/, html),
    description: pick(/<meta name="description" content="([^"]*)"/, html),
    canonical: pick(/<link rel="canonical" href="([^"]*)"/, html),
    lang: pick(/<html[^>]*\slang="([^"]*)"/, html),
    h1: [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()),
    imagesWithoutAlt: (html.match(/<img(?![^>]*\balt=)[^>]*>/g) || []).length,
    duplicateIds: Object.keys(ids).filter((k) => ids[k] > 1),
    links: [...links].sort(),
    text,
  };
}

// ── Tools ────────────────────────────────────────────────────────────────
const tools = {
  site_info: {
    description: 'Which site is being tested, whether order submission is enabled, and the public pages.',
    inputSchema: { type: 'object', properties: {} },
    run: async () => ({ baseUrl: BASE, local: IS_LOCAL, submitOrderEnabled: ORDERS_ON, publicPages: PUBLIC_PAGES,
      warning: 'The dev server uses the LIVE database and real e-mail. submit_order is off unless SWEETHEART_MCP_ALLOW_ORDERS=1.' }),
  },

  get_page: {
    description: 'Fetch one page: status, title, meta description, canonical, h1s, security headers, internal links and visible text (trimmed).',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'e.g. /feestcollectie' }, maxText: { type: 'number', description: 'max characters of visible text (default 4000)' } }, required: ['path'] },
    run: async ({ path, maxText = 4000 }) => {
      if (!String(path).startsWith('/')) throw new Error('path must start with /');
      const r = await fetchText(path);
      const a = analyse(r.text);
      const headers = Object.fromEntries(SECURITY_HEADERS.map((h) => [h, r.headers.get(h)]));
      return { path, status: r.status, redirect: r.location, headers, ...a, text: a.text.slice(0, maxText), textLength: a.text.length };
    },
  },

  check_site: {
    description: 'Crawl all public pages: broken internal links/images, missing title/description/canonical/h1, images without alt, duplicate ids, missing security headers, 404 page and sitemap.',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      const problems = [];
      const linkFrom = new Map();
      const pages = [];
      for (const p of PUBLIC_PAGES) {
        const r = await fetchText(p);
        const a = analyse(r.text);
        pages.push({ path: p, status: r.status, title: a.title, h1: a.h1.length });
        if (r.status !== 200) problems.push(`${p}: status ${r.status}`);
        if (!a.title) problems.push(`${p}: no <title>`);
        if (!a.description) problems.push(`${p}: no meta description`);
        else if (a.description.length > 160) problems.push(`${p}: meta description ${a.description.length} chars (Google cuts at ~160)`);
        if (!a.canonical) problems.push(`${p}: no canonical link`);
        if (a.h1.length !== 1) problems.push(`${p}: ${a.h1.length} <h1> elements (expected 1)`);
        if (a.imagesWithoutAlt) problems.push(`${p}: ${a.imagesWithoutAlt} <img> without alt`);
        if (a.duplicateIds.length) problems.push(`${p}: duplicate ids ${a.duplicateIds.join(', ')}`);
        const missing = SECURITY_HEADERS.filter((h) => !r.headers.get(h));
        if (missing.length) problems.push(`${p}: missing headers ${missing.join(', ')}`);
        for (const l of a.links) if (!linkFrom.has(l)) linkFrom.set(l, p);
      }
      const broken = [];
      for (const [link, from] of linkFrom) {
        const r = await fetch(BASE + link, { method: 'GET', redirect: 'follow' }).catch((e) => ({ status: String(e) }));
        if (r.status !== 200) broken.push({ link, status: r.status, foundOn: from });
      }
      const nf = await fetchText('/mcp-check-does-not-exist');
      if (nf.status !== 404) problems.push(`unknown URL returns ${nf.status} instead of 404`);
      const sm = await fetchText('/sitemap.xml');
      if (sm.status !== 200 || !sm.text.includes('<urlset')) problems.push('sitemap.xml missing or invalid');
      return { baseUrl: BASE, pages, linksChecked: linkFrom.size, broken, problems, ok: broken.length === 0 && problems.length === 0 };
    },
  },

  check_admin_protection: {
    description: 'Verify admin pages and admin APIs refuse visitors who are not logged in, including path tricks (trailing slash, double slash, upper case). Never sends POST and never changes data.',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      const variants = (p) => [p, p + '/', p.replace('/', '//'), p.toUpperCase().replace('/API/', '/api/'), p.replace(/^\/(\w)/, (m, c) => '/' + c.toUpperCase())];
      const results = [];
      for (const { path, method } of PROTECTED) {
        for (const v of [...new Set(variants(path))]) {
          const r = await fetchText(v, { method, headers: { Origin: ORIGIN, 'Content-Type': 'application/json' } });
          const toLogin = r.status >= 300 && r.status < 400 && (r.location || '').includes('/admin/login');
          // 401/403 = refused, redirect to login = refused, 404 = route does not exist under that spelling
          // A 200 is only a leak when it is really admin content (e.g. "//admin" just serves the home page)
          const adminContent = r.status === 200 && (/\/admin\/logout|"success":\s*true|^\s*\[/.test(r.text));
          const safe = r.status === 401 || r.status === 403 || r.status === 404 || toLogin || (r.status === 200 && !adminContent);
          results.push({ method, path: v, status: r.status, safe, ...(r.status === 200 ? { servedTitle: pick(/<title>([\s\S]*?)<\/title>/, r.text) } : {}) });
        }
      }
      const unsafe = results.filter((r) => !r.safe);
      return { ok: unsafe.length === 0, unsafe, checked: results.length, results };
    },
  },

  catalog: {
    description: 'Everything a customer can choose in the aanvraag form: products, occasions, cake sizes (with base price and deposit), flavours with price category, toppers, mini types, quantities and pickup times.',
    inputSchema: { type: 'object', properties: {} },
    run: async () => ({
      products: PRODUCTS.map(({ id, name, from }) => ({ id, name, from })),
      events: EVENTS.map((o) => o.value),
      cakeSizes: CAKE_SIZES.map(({ value, persons, layers, base, deposit }) => ({ value, persons, layers, base, deposit })),
      flavorCategories: FLAVOR_CATEGORIES,
      cakeFlavors: CAKE_FLAVORS.map(({ value, label, category }) => ({ value, label, category })),
      otherFlavors: FLAVORS.map((o) => o.value),
      toppers: TOPPERS.map(({ value, label, hint }) => ({ value, label, hint })),
      miniTypes: MINI_TYPES, koekjes: KOEKJES_QTY, miniMax: MINI_MAX, maxItems: MAX_ITEMS, pickupTimes: PICKUP_TIMES,
    }),
  },

  quote: {
    description: 'Price, deposit and validation errors for aanvraag items, using the website\'s own pricing code. Example item: {"product":"feesttaart","event":"verjaardag","persons":"12","flavor":"pure-pistache"}.',
    inputSchema: { type: 'object', properties: { items: { type: 'array', items: { type: 'object' } } }, required: ['items'] },
    run: async ({ items }) => {
      const lines = items.map((item) => ({ item, summary: itemSummary(item), price: itemPrice(item), deposit: itemDeposit(item), errors: validateItem(item) }));
      return { lines, total: round(lines.reduce((s, l) => s + l.price, 0)), deposit: lines.reduce((s, l) => s + l.deposit, 0), valid: lines.every((l) => !l.errors.length) };
    },
  },

  availability: {
    description: 'Free days and pickup times as the order calendar sees them (GET /api/availability). Dates as YYYY-MM-DD.',
    inputSchema: { type: 'object', properties: { startDate: { type: 'string' }, endDate: { type: 'string' } } },
    run: async ({ startDate, endDate } = {}) => {
      const q = new URLSearchParams(Object.entries({ startDate, endDate }).filter(([, v]) => v));
      const r = await fetchText(`/api/availability${q.size ? `?${q}` : ''}`);
      try { return { status: r.status, data: JSON.parse(r.text) }; } catch { return { status: r.status, body: r.text.slice(0, 2000) }; }
    },
  },

  validate_order: {
    description: 'Dry run of a full aanvraag (contact, date, time, items) against the same rules as the server, plus a live availability check for the date. Writes nothing.',
    inputSchema: orderSchema(),
    run: async (order) => ({ ...(await checkOrder(order)), submitted: false }),
  },

  submit_order: {
    description: 'Really POST an aanvraag to /api/orders. Disabled unless SWEETHEART_MCP_ALLOW_ORDERS=1. Writes to the database the site uses (the dev server uses the LIVE one) and may send e-mails. Message is tagged [MCP TEST].',
    inputSchema: { ...orderSchema(), properties: { ...orderSchema().properties, confirmWrites: { type: 'boolean', description: 'must be true: you understand this creates a real order' } } },
    run: async (order) => {
      if (!ORDERS_ON) throw new Error(`submit_order is disabled. Set SWEETHEART_MCP_ALLOW_ORDERS=1${IS_LOCAL ? '' : ' and SWEETHEART_MCP_ALLOW_REMOTE=1'} to enable it.`);
      if (order.confirmWrites !== true) throw new Error('Set confirmWrites: true to place a real order.');
      const check = await checkOrder(order);
      if (!check.valid) return { submitted: false, ...check };
      const body = { customer: order.customer, date: order.date, time: order.time, items: order.items, message: `[MCP TEST] ${order.message || ''}`.trim() };
      const r = await fetchText('/api/orders', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      let data; try { data = JSON.parse(r.text); } catch { data = r.text.slice(0, 1000); }
      return { submitted: r.status === 201, status: r.status, response: data, expectedTotal: check.total };
    },
  },
};

function round(n) { return Math.round(n * 100) / 100; }

function orderSchema() {
  return {
    type: 'object',
    properties: {
      customer: { type: 'object', properties: { firstname: { type: 'string' }, lastname: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' } } },
      date: { type: 'string', description: 'YYYY-MM-DD' },
      time: { type: 'string', description: 'HH:MM, one of the pickup times' },
      items: { type: 'array', items: { type: 'object' } },
      message: { type: 'string' },
    },
    required: ['customer', 'date', 'time', 'items'],
  };
}

async function checkOrder({ customer = {}, date, time, items = [] }) {
  const errors = [];
  if (!customer.firstname || !customer.lastname) errors.push('first and last name required');
  if (!EMAIL_RE.test(String(customer.email || ''))) errors.push('invalid e-mail');
  if (!isValidPhone(String(customer.phone || ''))) errors.push('invalid phone');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) errors.push('date must be YYYY-MM-DD');
  if (!/^\d{2}:\d{2}$/.test(String(time))) errors.push('time must be HH:MM');
  if (!items.length) errors.push('at least one item');
  if (items.length > MAX_ITEMS) errors.push(`max ${MAX_ITEMS} items`);
  items.forEach((it, i) => validateItem(it).forEach((e) => errors.push(`item ${i + 1}: ${e}`)));
  let day = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    const r = await fetchText(`/api/availability?startDate=${date}&endDate=${date}`);
    try {
      const data = JSON.parse(r.text);
      const list = Array.isArray(data) ? data : data.days || data.availability || [];
      day = list.find?.((d) => d.date === date) ?? data[date] ?? null;
      if (day && day.available === false) errors.push(`date not available${day.reason ? `: ${day.reason}` : ''}`);
      if (day?.times && time && !day.times.includes(time)) errors.push(`time ${time} not offered that day (offered: ${day.times.join(', ')})`);
    } catch { errors.push(`availability check failed (status ${r.status})`); }
  }
  const total = round(items.reduce((s, it) => s + itemPrice(it), 0));
  const deposit = items.reduce((s, it) => s + itemDeposit(it), 0);
  return { valid: errors.length === 0, errors, total, deposit, day };
}

// ── MCP over stdio (JSON-RPC 2.0, one message per line) ──────────────────
const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const rl = createInterface({ input: process.stdin });

rl.on('line', async (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
  const { id, method, params } = msg;
  if (id === undefined) return; // notification (e.g. notifications/initialized)
  try {
    if (method === 'initialize') {
      return send({ jsonrpc: '2.0', id, result: {
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'sweetheart-test', version: '1.0.0' },
        instructions: `Tests the Sweetheart website at ${BASE}. Start with site_info. Everything is read-only except submit_order (${ORDERS_ON ? 'ENABLED — writes real orders' : 'disabled'}).`,
      } });
    }
    if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
    if (method === 'tools/list') {
      return send({ jsonrpc: '2.0', id, result: { tools: Object.entries(tools).map(([name, t]) => ({ name, description: t.description, inputSchema: t.inputSchema })) } });
    }
    if (method === 'tools/call') {
      const tool = tools[params?.name];
      if (!tool) return send({ jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown tool ${params?.name}` } });
      try {
        const result = await tool.run(params.arguments || {});
        return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } });
      } catch (err) {
        const hint = /fetch failed|ECONNREFUSED/.test(String(err?.cause?.code || err?.message)) ? ` — is the site running at ${BASE}? (npm run dev)` : '';
        return send({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: `${err?.message || err}${hint}` }] } });
      }
    }
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
  } catch (err) {
    send({ jsonrpc: '2.0', id, error: { code: -32603, message: String(err?.message || err) } });
  }
});
