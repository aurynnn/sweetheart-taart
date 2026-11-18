import type { APIRoute } from 'astro';
import { disconnect } from '../../../../lib/googleCalendar';

export const POST: APIRoute = async ({ redirect }) => {
  await disconnect();
  return redirect('/admin/calendar?disconnected=true');
};
