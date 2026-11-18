import type { APIRoute } from 'astro';
import { syncUpcomingOrders } from '../../../../lib/googleCalendar';

// "Nu synchroniseren": rewrite every order from the last week onward
export const POST: APIRoute = async ({ redirect }) => {
  const { synced, failed } = await syncUpcomingOrders();
  return redirect(`/admin/calendar?synced=${synced}${failed ? `&failed=${failed}` : ''}`);
};
