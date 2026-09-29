import type { APIRoute } from 'astro';
import { listOrders } from '../../lib/orderRepo';
import * as templates from '../../lib/email/templates';

// Admin-only preview of the e-mails, rendered with the most recent aanvraag.
//   /admin/email-preview                      → overview with links
//   /admin/email-preview?t=aanvraagOntvangen  → that e-mail (add &format=text for plain text)
const NAMES: Record<string, string> = {
  aanvraagOntvangen: 'Klant: aanvraag ontvangen',
  nieuweAanvraag: 'Nathalie: nieuwe aanvraag',
  aanvraagBevestigd: 'Klant: aanvraag bevestigd',
  aanvraagGeweigerd: 'Klant: aanvraag niet mogelijk',
};

export const GET: APIRoute = async ({ url }) => {
  const [order] = await listOrders();
  if (!order) return new Response('Nog geen aanvragen om een voorbeeld mee te tonen.', { status: 404 });

  const t = url.searchParams.get('t');
  const render = t && t in NAMES ? (templates as any)[t] : null;
  if (!render) {
    const links = Object.entries(NAMES)
      .map(([key, label]) => `<li><a href="?t=${key}">${label}</a> · <a href="?t=${key}&format=text">tekst</a></li>`)
      .join('');
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>E-mail voorbeelden</title>
       <body style="font-family:system-ui;padding:2rem;line-height:1.8"><h1>E-mail voorbeelden</h1>
       <p>Gebaseerd op aanvraag <b>${order.id}</b>. Er wordt niets verstuurd.</p><ul>${links}</ul></body>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const mail = render(order);
  if (url.searchParams.get('format') === 'text') {
    return new Response(`Onderwerp: ${mail.subject}\n\n${mail.text}`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  return new Response(mail.html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Email-Subject': encodeURIComponent(mail.subject) } });
};
