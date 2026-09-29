import type { APIRoute } from 'astro';
import { getObject } from '../../../lib/r2';
import { isUploadKey } from '../../../lib/catalog';

// Streams a customer's example photo to the admin panel (keys are private, not linked publicly).
export const GET: APIRoute = async ({ url }) => {
  const key = url.searchParams.get('key') || '';
  if (!isUploadKey(key)) return new Response('Not found', { status: 404 });
  const res = await getObject(key);
  if (!res.ok || !res.body) return new Response('Not found', { status: 404 });
  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'private, max-age=86400',
      'Content-Disposition': `inline; filename="${key.split('/').pop()}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
