import type { APIRoute } from 'astro';
import { exportCustomer } from '../../../../../lib/customers';

// GDPR right of access / portability: everything we store about one customer as JSON
export const GET: APIRoute = async ({ params }) => {
  const data = await exportCustomer(String(params.id));
  if (!data) return new Response('Niet gevonden', { status: 404 });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="gegevens-${params.id}.json"`,
      'Cache-Control': 'no-store',
    },
  });
};
