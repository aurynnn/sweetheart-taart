// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  port: 4000,
  host: true,
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [svelte()],
  // Old URL keeps working for bookmarks, printed flyers and search results
  redirects: {
    '/bestellen': { status: 301, destination: '/aanvraag' },
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: ['.trycloudflare.com', '.cloudflareaccess.com'],
    },
  },
});
