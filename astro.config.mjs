// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  port: 4000,
  host: true,
  integrations: [svelte()],

  vite: {
    plugins: [tailwindcss()]
  }
});