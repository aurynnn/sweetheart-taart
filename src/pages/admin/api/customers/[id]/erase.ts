import type { APIRoute } from 'astro';
import { eraseCustomer, getCustomerDetail } from '../../../../../lib/customers';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

// GDPR right to erasure. Requires typing the customer's e-mail address as confirmation.
export const POST: APIRoute = async ({ params, request }) => {
  const id = String(params.id);
  const { confirmEmail } = await request.json().catch(() => ({} as any));
  const detail = await getCustomerDetail(id);
  if (!detail) return json({ success: false, error: 'Klant niet gevonden' }, 404);
  if (String(confirmEmail ?? '').trim().toLowerCase() !== detail.customer.email.toLowerCase()) {
    return json({ success: false, error: 'Het e-mailadres komt niet overeen' }, 400);
  }
  await eraseCustomer(id);
  console.info(`[gdpr] customer ${id} erased`);
  return json({ success: true });
};
