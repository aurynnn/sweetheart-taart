import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ redirect }) => {
  // In production, revoke tokens in database
  // TODO: Revoke Google token: await fetch('https://oauth2.googleapis.com/revoke', ...)
  // TODO: Clear tokens from database

  console.log('Google Calendar disconnected');

  return redirect('/admin/calendar?disconnected=true');
};
