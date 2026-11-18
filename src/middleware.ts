import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, readSession, requiresAdmin, clientIp } from './lib/auth';
import { limiterFor, withinLimit } from './lib/rateLimit';

// Sent with every response: no framing by other sites, no MIME sniffing, HTTPS only
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

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

  // Burst protection on login and public forms (a logged-in admin is never limited)
  const limiter = session ? null : limiterFor(url.pathname, request.method);
  if (limiter && !(await withinLimit(limiter, `${url.pathname}:${clientIp(request, context.clientAddress)}`))) {
    if (limiter === 'LOGIN_LIMITER') {
      (locals as any).rateLimited = true; // the login page shows the message
    } else {
      return new Response(JSON.stringify({ success: false, error: 'Even rustig aan: te veel verzoeken na elkaar. Probeer het over een minuutje opnieuw.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }
  }

  const response = await next();
  try {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      if (!response.headers.has(name)) response.headers.set(name, value);
    }
    if (url.protocol === 'https:') response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  } catch { /* some responses (e.g. fetched assets) have immutable headers */ }
  // Admin pages must never be cached or indexed
  if (url.pathname.startsWith('/admin')) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
});
