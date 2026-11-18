# Sweetheart – website & bestelsysteem

Website for Sweetheart (Nathalie, Oostende): collection pages, an order form ("aanvraag")
with live availability, an admin for orders/customers/calendar, and the e-mails around an order.

- **Stack:** Astro 7 (SSR) + Svelte 5 on a Cloudflare Worker; data in Cloudflare D1; photos in R2;
  e-mail via MailerSend; optional Google Calendar sync.
- **Prices & options:** `src/lib/catalog.ts` — the single source for the order form, the
  Feestcollectie price tables, stored order totals and the e-mails.
- **Business details:** `src/config/site.ts` (address, phone, opening hours, company number).

## Commands

| Command | |
|---|---|
| `npm run dev` | Dev server on http://localhost:4321 — ⚠ uses the **live** D1 database and real e-mail (set `MAIL_ENABLED=false` in `.env` while testing) |
| `npm run build` | Production build |
| `npx wrangler deploy` | Deploy the Worker (after `npm run build`) |
| `node mcp/server.mjs` | Test MCP for agents — see `mcp/README.md` |

Configuration: copy `.env.example` to `.env` for local work. In production every value is a
Worker secret/variable (`npx wrangler secret put NAME` or the Cloudflare dashboard).

## Database migrations

SQL files in `migrations/`, applied by hand with
`npx wrangler d1 execute sweetheart-db --remote --file=migrations/<file>.sql`.
Back up first: `npx wrangler d1 export sweetheart-db --remote --output=backup-<date>.sql`.

| Migration | Live DB (18 nov 2026) |
|---|---|
| 0004 time, topper, quantity | applied (by hand) |
| 0005 first/last name | applied 18 nov 2026 (backup in `backups/`, not in git) |
| 0006 item details (mini type, per-product wishes, photo) | applied 18 nov 2026 |
| 0007, 0008 | tables exist (the app creates them itself) |

## Launch checklist

The live domain still serves the old WordPress site. Nathalie does not use mail on the domain, so no mail records need to be kept.

**Before switching the domain**
- [x] KBO company number (BE 0688.861.039) — shown in the footer, terms and privacy page.
- [x] Migrations 0005 and 0006 applied; test orders/customers removed (numbering restarts at ORD-001).
- [ ] Worker secrets set: `CLOUDFLARE_API_TOKEN`, `CF_ACCOUNT_ID`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` (long, unique),
      `APP_SECRET` (random, 32+ chars), `MAILERSEND_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `ADMIN_NOTIFY_EMAIL`,
      `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `PUBLIC_R2_BASE_URL`, `SITE_URL=https://sweetheart-taart.com`.
- [ ] MailerSend: verify the domain `sweetheart-taart.com` (adds DKIM + return-path DNS records) and add
      `include:_spf.mailersend.net` to the SPF record; add a DMARC record (e.g. `v=DMARC1; p=none; rua=mailto:…`).
      Without this, order e-mails land in spam or bounce. Until then the sender is a temporary address on an
      already verified domain (`MAIL_FROM_EMAIL`); customer replies go to `ADMIN_NOTIFY_EMAIL`.
- [ ] `npm run build && npx wrangler deploy`, then open the `*.workers.dev` URL and place one real test order end to end
      (form → e-mail to customer → e-mail to Nathalie → admin → bevestigen → bevestigingsmail).

**Switching the domain** (DNS to Cloudflare)
- [ ] Move the domain's DNS to Cloudflare. No mail is used on the domain; MailerSend's DNS records (above) go in Cloudflare DNS.
- [ ] Add `sweetheart-taart.com` and `www.sweetheart-taart.com` as Custom Domains of the Worker
      (the site redirects www → main domain itself).
- [ ] Old WordPress URLs are redirected (`astro.config.mjs` → `redirects`); check a few after the switch.

**After the switch**
- [ ] Google Search Console: add the domain, submit `/sitemap.xml`.
- [ ] Google Business profile: website link → `https://sweetheart-taart.com`.
- [ ] Optional: connect Google Agenda in Admin → Beschikbaarheid.
- [ ] Keep the old hosting until mail and the site have run fine for a few weeks.

## Known follow-ups (not blocking)

- Production queries D1 via the REST API (`src/lib/d1.ts`) instead of the `DB` binding in `wrangler.toml`.
  Using the binding is faster and removes the API token from the Worker, but changes local dev to a local
  database — worth doing together with a separate test database.
- ~12 MB of unused files in `public/` (old hero/promo videos, duplicate `koekjes.png`, `cupcakes.png`, …).
