import type { APIRoute } from 'astro';
import { getPickupConfig, normalizeConfig, savePickupConfig } from '../../../lib/pickupTimes';
import { toLocalDateStr } from '../../../lib/availability';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async () => json(await getPickupConfig());

export const POST: APIRoute = async ({ request }) => {
  try {
    const config = normalizeConfig(await request.json(), toLocalDateStr(new Date()));
    await savePickupConfig(config);
    return json({ success: true, config });
  } catch (error: any) {
    return json({ success: false, error: error?.message ?? 'Opslaan mislukt' }, 400);
  }
};
