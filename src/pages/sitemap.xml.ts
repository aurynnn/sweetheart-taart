// src/pages/sitemap.xml.ts — The public pages for search engines (admin, API and e-mail landing pages left out)
import type { APIRoute } from 'astro';
import { SITE } from '../config/site';

const PAGES = ['/', '/feestcollectie', '/koekjescollectie', '/mini-collectie', '/aanvraag', '/volgende-taart', '/tips', '/privacy', '/algemene-voorwaarden'];

export const GET: APIRoute = () => {
  const urls = PAGES.map((p) => `  <url><loc>${SITE.url}${p === '/' ? '/' : p}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
  });
};
