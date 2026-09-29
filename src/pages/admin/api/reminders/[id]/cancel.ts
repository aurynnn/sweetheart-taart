import type { APIRoute } from 'astro';
import { cancelReminder, getReminder } from '../../../../../lib/reminders';

export const POST: APIRoute = async ({ params }) => {
  const reminder = await getReminder(String(params.id));
  if (!reminder) return new Response(JSON.stringify({ success: false, error: 'Niet gevonden' }), { status: 404 });
  await cancelReminder(reminder.id);
  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
};
