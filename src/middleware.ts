import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, readSession, requiresAdmin } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, request, cookies, redirect, locals } = context;
  const session = readSession(cookies.get(SESSION_COOKIE)?.value);
  (locals as any).admin = session;

  if (requiresAdmin(url.pathname, request.method) && !session) {
    const isPage = request.method === 'GET' && url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/api/');
    if (isPage) {
      const nextPath = url.pathname + url.search;
      return redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`, 302);
    }
    return new Response(JSON.stringify({ success: false, error: 'Niet ingelogd' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const response = await next();
  // Admin pages must never be cached or indexed
  if (url.pathname.startsWith('/admin')) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
});
