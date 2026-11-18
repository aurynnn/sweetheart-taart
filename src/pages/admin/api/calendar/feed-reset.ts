import type { APIRoute } from 'astro';
import { resetFeedToken } from '../../../../lib/calendarFeed';

// New subscription link (e.g. when the old one was shared by accident)
export const POST: APIRoute = async ({ redirect }) => {
  await resetFeedToken();
  return redirect('/admin/calendar?feedReset=true');
};
