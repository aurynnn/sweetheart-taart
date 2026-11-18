// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  // Cloudflare Worker (config in wrangler.toml, entry src/worker.ts)
  adapter: cloudflare({ imageService: 'passthrough' }),
  // No Astro sessions (admin login is a signed cookie) → no KV namespace needed
  session: false,
  integrations: [svelte()],
  // Old URL keeps working for bookmarks, printed flyers and search results
  redirects: {
    '/bestellen': { status: 301, destination: '/aanvraag' },
    // Old WordPress site (www.sweetheart-taart.com) — keeps Google results, Facebook posts and old mails working
    '/collecties': { status: 301, destination: '/#home-collections' },
    '/vaste-collectie': { status: 301, destination: '/feestcollectie' },
    '/afternoon-tea': { status: 301, destination: '/mini-collectie' },
    '/kerstcollectie': { status: 301, destination: '/aanvraag' },
    '/aanvraag-kerst-buffet': { status: 301, destination: '/aanvraag' },
    '/2024/11/20/kerst-dessert-buffet': { status: 301, destination: '/aanvraag' },
    '/2024/11/20/kerstcollectie-bestellen': { status: 301, destination: '/aanvraag' },
    '/winkel': { status: 301, destination: '/aanvraag' },
    '/winkelwagen': { status: 301, destination: '/aanvraag' },
    '/afrekenen': { status: 301, destination: '/aanvraag' },
    '/mijn-account': { status: 301, destination: '/' },
    '/feed': { status: 301, destination: '/' },
  },
  vite: {
    plugins: [tailwindcss()],
    // Older iPhones (iOS 15+): adds -webkit- prefixes (e.g. backdrop-filter) and lowers syntax
    build: { cssTarget: ['safari15', 'ios15', 'chrome100', 'firefox100', 'edge100'] },
    server: {
      allowedHosts: ['.trycloudflare.com', '.cloudflareaccess.com'],
    },
  },
});
