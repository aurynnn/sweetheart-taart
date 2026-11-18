import type { APIRoute } from 'astro';
import { connect, syncUpcomingOrders } from '../../../../lib/googleCalendar';
import { inBackground } from '../../../../lib/background';

export const GET: APIRoute = async ({ url, cookies, redirect, locals }) => {
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = cookies.get('sh_gcal_state')?.value;
  cookies.delete('sh_gcal_state', { path: '/admin/api/calendar' });

  if (error) return redirect(`/admin/calendar?error=${encodeURIComponent(error)}`);
  if (!code) return redirect('/admin/calendar?error=no_code');
  if (!state || state !== url.searchParams.get('state')) return redirect('/admin/calendar?error=state');

  try {
    await connect(code, url.origin);
    // Existing orders go into the new calendar in the background
    inBackground(locals, syncUpcomingOrders(), 'calendar initial sync');
    return redirect('/admin/calendar?connected=true');
  } catch (err) {
    console.error('Google OAuth error:', err);
    return redirect('/admin/calendar?error=token_exchange_failed');
  }
};
