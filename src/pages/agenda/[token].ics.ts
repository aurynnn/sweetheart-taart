// src/pages/agenda/[token].ics.ts — The private agenda feed (see lib/calendarFeed.ts).
// Public on purpose: agenda apps fetch it without logging in; the long token is the key.
import type { APIRoute } from 'astro';
import { isValidFeedToken, renderFeed } from '../../lib/calendarFeed';

export const GET: APIRoute = async ({ params }) => {
  if (!(await isValidFeedToken(params.token ?? ''))) return new Response('Not found', { status: 404 });
  return new Response(await renderFeed(), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="sweetheart-bestellingen.ics"',
      'Cache-Control': 'private, max-age=300',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
};
