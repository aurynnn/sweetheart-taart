import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { getAuthUrl, googleConfigured } from '../../../../lib/googleCalendar';
import { isSecureRequest } from '../../../../lib/auth';

// Sends the owner to Google's consent screen; `state` guards the callback against forged requests
export const GET: APIRoute = async ({ url, request, cookies, redirect }) => {
  if (!googleConfigured()) return redirect('/admin/calendar?error=not_configured');
  const state = randomBytes(16).toString('hex');
  cookies.set('sh_gcal_state', state, {
    path: '/admin/api/calendar', httpOnly: true, sameSite: 'lax', secure: isSecureRequest(request, url), maxAge: 600,
  });
  return redirect(getAuthUrl(url.origin, state));
};
