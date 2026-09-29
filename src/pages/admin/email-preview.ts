import type { APIRoute } from 'astro';
import { listOrders } from '../../lib/orderRepo';
import { PREVIEWS } from '../../lib/email/previews';

// Admin-only preview of the e-mails, rendered with the most recent aanvraag (reminders use example data).
//   /admin/email-preview                      → overview with links
//   /admin/email-preview?t=aanvraagOntvangen  → that e-mail (add &format=text for plain text)
const NAMES: Record<string, string> = Object.fromEntries(Object.entries(PREVIEWS).map(([k, v]) => [k, v.label]));

export const GET: APIRoute = async ({ url }) => {
  const [order] = await listOrders();
  if (!order) return new Response('Nog geen aanvragen om een voorbeeld mee te tonen.', { status: 404 });

  const t = url.searchParams.get('t');
  const render = t && PREVIEWS[t] ? PREVIEWS[t].render : null;
  if (!render) {
    const links = Object.entries(NAMES)
      .map(([key, label]) => `<li><a href="?t=${key}">${label}</a> · <a href="?t=${key}&format=text">tekst</a></li>`)
      .join('');
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>E-mail voorbeelden</title>
       <body style="font-family:system-ui;padding:2rem;line-height:1.8"><h1>E-mail voorbeelden</h1>
       <p>Gebaseerd op aanvraag <b>${order.id}</b>. Bekijken verstuurt niets.</p><ul>${links}</ul>
       <h2>Testmail versturen</h2>
       <form id="t" style="display:flex;gap:.5rem;flex-wrap:wrap">
         <input name="to" type="email" required placeholder="jij@voorbeeld.be" style="padding:.5rem">
         <select name="template" style="padding:.5rem">${Object.entries(NAMES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
         <button style="padding:.5rem 1rem">Verstuur test</button>
       </form>
       <p id="r"></p>
       <script>
         document.getElementById('t').addEventListener('submit', async (e) => {
           e.preventDefault();
           const f = new FormData(e.target), r = document.getElementById('r');
           r.textContent = 'Versturen…';
           const res = await fetch('/admin/api/email-test', { method: 'POST', headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ to: f.get('to'), template: f.get('template') }) });
           const d = await res.json();
           r.textContent = d.success ? '✓ Verstuurd — kijk ook in je spam.' : '✗ ' + d.error;
         });
       </script></body>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const mail = render(order);
  if (url.searchParams.get('format') === 'text') {
    return new Response(`Onderwerp: ${mail.subject}\n\n${mail.text}`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  return new Response(mail.html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Email-Subject': encodeURIComponent(mail.subject) } });
};
