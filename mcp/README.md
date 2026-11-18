# sweetheart-test MCP

An MCP server so an agent (Claude Code, opencode, …) can test the website.
No dependencies; needs Node ≥ 23.6. It imports `src/lib/catalog.ts`, so its price
quotes always use the same code as the website.

## Use

1. Start the site: `npm run dev` (port 4321).
2. The server is registered in `.mcp.json`, so Claude Code picks it up in this folder.
   Other clients: run `node mcp/server.mjs` over stdio.
3. To test another address, set `SWEETHEART_BASE_URL` (e.g. a preview deploy).

## Tools

| Tool | What it does | Writes? |
|---|---|---|
| `site_info` | Site under test, whether orders are enabled, public pages | no |
| `get_page` | One page: status, title, description, canonical, h1, security headers, links, text | no |
| `check_site` | Crawls all public pages: broken links/images, SEO basics, alt texts, duplicate ids, headers, 404, sitemap | no |
| `check_admin_protection` | Admin pages/APIs refuse anonymous visitors, also with path tricks (`/x/`, `//x`, upper case). GET/PUT only | no |
| `catalog` | All choices in the order form: sizes, flavours, toppers, prices, deposits | no |
| `quote` | Price, deposit and validation errors for items, using the site's own pricing | no |
| `availability` | Free days and pickup times | no |
| `validate_order` | Dry run of a full aanvraag, including a live date/time check | no |
| `submit_order` | Places a real aanvraag | **yes**, off by default |

## ⚠ Orders write to the live database

The dev server talks to the **production** D1 database and sends real e-mails when
`MAILERSEND_API_KEY` is set. So `submit_order` is disabled unless:

- `SWEETHEART_MCP_ALLOW_ORDERS=1` is set (and `SWEETHEART_MCP_ALLOW_REMOTE=1` for a non-local URL), and
- the call passes `confirmWrites: true`.

Test orders get `[MCP TEST]` in their message, so they're easy to find and delete in the admin.
Run the dev server with `MAIL_ENABLED=false` to avoid sending e-mails.
A separate test database would make this fully safe (set `D1_DATABASE_ID` for the dev server).

## After changing prices or options

The server imports `src/lib/catalog.ts` once at start-up. After editing the catalog, restart
the MCP (Claude Code: `/mcp` → reconnect `sweetheart-test`), or `quote` and `catalog` will
still use the old prices.
