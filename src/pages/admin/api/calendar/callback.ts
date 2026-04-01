import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, redirect }) => {
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return redirect(`/admin/calendar?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return redirect('/admin/calendar?error=no_code');
  }

  try {
    const clientId = import.meta.env.GOOGLE_CLIENT_ID;
    const clientSecret = import.meta.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321'}/admin/api/calendar/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    const tokens = await tokenResponse.json();

    // In production, store tokens in database linked to user
    // For now, we'll store in a cookie or return success
    console.log('Google Calendar connected successfully');
    console.log('Access token:', tokens.access_token ? 'received' : 'missing');
    console.log('Refresh token:', tokens.refresh_token ? 'received' : 'missing');

    // TODO: Store tokens in your database
    // await db.users.update(userId, { googleCalendarTokens: tokens });

    return redirect('/admin/calendar?connected=true');
  } catch (err) {
    console.error('Google OAuth error:', err);
    return redirect('/admin/calendar?error=token_exchange_failed');
  }
};
