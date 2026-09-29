// src/lib/email/templates.ts — The e-mails Sweetheart sends. Each returns subject + HTML + plain text.

import { SITE, fullAddress, directionsUrl } from '../../config/site';
import { itemPrice, itemSummary, productName, formatEuro, type AanvraagItem } from '../catalog';
import type { FullOrder } from '../orderRepo';
import { COLORS, button, callout, detailRows, esc, heading, layout, paragraph, siteUrl, steps } from './layout';

export interface RenderedEmail { subject: string; html: string; text: string }

const formatDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const pickup = (o: Pick<FullOrder, 'date' | 'time'>) => `${formatDate(o.date)}${o.time ? ` om ${o.time}` : ''}`;

function itemLine(item: FullOrder['items'][number]) {
  const summary = itemSummary(item as AanvraagItem);
  return { name: productName(item.product), summary, price: item.price || itemPrice(item as AanvraagItem) };
}

/** Product table with optional per-item notes (allergies, wishes, photo) */
function itemsTable(order: FullOrder, forAdmin = false): string {
  const rows = order.items.map((item) => {
    const { name, summary, price } = itemLine(item);
    const extras = [
      item.allergies ? `<div style="margin-top:4px;color:#B45309;font-weight:700">⚠ Allergieën: ${esc(item.allergies)}</div>` : '',
      item.message ? `<div style="margin-top:4px;color:${COLORS.muted};font-style:italic">“${esc(item.message)}”</div>` : '',
      item.image
        ? forAdmin
          ? `<div style="margin-top:4px"><a href="${esc(siteUrl(`/admin/api/upload?key=${encodeURIComponent(item.image)}`))}" style="color:${COLORS.pinkDark}">📷 Voorbeeldfoto bekijken</a></div>`
          : `<div style="margin-top:4px;color:${COLORS.muted}">📷 Voorbeeldfoto toegevoegd</div>`
        : '',
    ].join('');
    return `<tr>
      <td style="padding:12px 0;border-bottom:1px solid ${COLORS.line};font-family:Helvetica,Arial,sans-serif;font-size:15px;color:${COLORS.ink};vertical-align:top">
        <strong>${esc(name)}</strong><br><span style="font-size:14px;color:${COLORS.muted}">${esc(summary || 'Standaard')}</span>${extras}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid ${COLORS.line};font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:${COLORS.pinkDark};text-align:right;vertical-align:top;white-space:nowrap">${esc(formatEuro(price))}</td>
    </tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px;border-collapse:collapse">${rows}
    <tr>
      <td style="padding:14px 0 20px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:${COLORS.ink}"><strong>Totaal</strong> <span style="color:${COLORS.muted};font-size:13px">(indicatie)</span></td>
      <td style="padding:14px 0 20px;font-family:Helvetica,Arial,sans-serif;font-size:18px;font-weight:800;color:${COLORS.pinkDark};text-align:right">${esc(order.total)}</td>
    </tr>
  </table>`;
}

function itemsText(order: FullOrder): string {
  return order.items.map((item) => {
    const { name, summary, price } = itemLine(item);
    return `- ${name}${summary ? ` (${summary})` : ''}: ${formatEuro(price)}${item.allergies ? `\n  Allergieën: ${item.allergies}` : ''}${item.message ? `\n  Wensen: ${item.message}` : ''}`;
  }).join('\n') + `\nTotaal (indicatie): ${order.total}`;
}

const contactText = `${SITE.owner} — ${SITE.name}\n${fullAddress}\n${SITE.phone.display} · ${SITE.email}`;

// ── 1. Customer: aanvraag ontvangen ────────────────────────────────────────
export function aanvraagOntvangen(order: FullOrder): RenderedEmail {
  const name = order.customer.firstname || 'daar';
  const body = [
    heading(`Bedankt, ${name}!`),
    paragraph(`We hebben je aanvraag <strong>#${esc(order.id)}</strong> goed ontvangen. Hieronder vind je een overzicht.`),
    callout(`<strong>Ophalen:</strong> ${esc(pickup(order))}<br><span style="color:${COLORS.muted}">${esc(fullAddress)}</span>`),
    itemsTable(order),
    paragraph(`<strong>Wat gebeurt er nu?</strong>`),
    steps([
      [`${SITE.owner} bekijkt je aanvraag`, 'Meestal binnen 1 à 2 werkdagen.'],
      ['Je krijgt een bevestiging', 'Per mail of telefoon, met de definitieve prijs.'],
      ['Ophalen & smullen', `Op ${pickup(order)}.`],
    ]),
    paragraph(`Dit is een <strong>vrijblijvende aanvraag</strong> — je betaalt nu nog niets. Iets wijzigen of een vraag? Beantwoord gewoon deze mail of bel ${esc(SITE.phone.display)}.`),
  ].join('');
  return {
    subject: `We hebben je aanvraag ontvangen 🎂 (#${order.id})`,
    html: layout({ preheader: `Ophalen op ${pickup(order)} — ${SITE.owner} neemt snel contact op.`, body }),
    text: `Bedankt, ${name}!\n\nWe hebben je aanvraag #${order.id} goed ontvangen.\n\nOphalen: ${pickup(order)}\n${fullAddress}\n\n${itemsText(order)}\n\n${SITE.owner} bekijkt je aanvraag en bevestigt meestal binnen 1 à 2 werkdagen, met de definitieve prijs. Je betaalt nu nog niets.\n\n${contactText}`,
  };
}

// ── 2. Nathalie: nieuwe aanvraag ───────────────────────────────────────────
export function nieuweAanvraag(order: FullOrder): RenderedEmail {
  const c = order.customer;
  const who = [c.firstname, c.lastname].filter(Boolean).join(' ') || c.email;
  const hasAllergy = order.items.some((i) => i.allergies);
  const body = [
    heading('Nieuwe aanvraag!'),
    paragraph(`<strong>${esc(who)}</strong> heeft zonet een aanvraag verstuurd${hasAllergy ? ' — <span style="color:#B45309;font-weight:700">met allergieën</span>' : ''}.`),
    detailRows([
      ['Aanvraag', `#${esc(order.id)}`],
      ['Ophalen', esc(pickup(order))],
      ['E-mail', `<a href="mailto:${esc(c.email)}" style="color:${COLORS.pinkDark}">${esc(c.email)}</a>`],
      ['Telefoon', `<a href="tel:${esc(c.phone.replace(/[^0-9+]/g, ''))}" style="color:${COLORS.pinkDark}">${esc(c.phone)}</a>`],
    ]),
    itemsTable(order, true),
    order.message ? callout(`<strong>Opmerking van de klant:</strong><br>${esc(order.message).replace(/\n/g, '<br>')}`) : '',
    button(siteUrl('/admin'), 'Bekijk en bevestig in het dashboard'),
    paragraph(`<span style="font-size:13px;color:${COLORS.muted}">Tip: beantwoord deze mail om de klant rechtstreeks te mailen.</span>`),
  ].join('');
  return {
    subject: `🎂 Nieuwe aanvraag van ${who} — ${formatDate(order.date)}`,
    html: layout({ preheader: `${who} · ophalen ${pickup(order)} · ${order.total}`, body, signature: false }),
    text: `Nieuwe aanvraag #${order.id} van ${who}\n\nOphalen: ${pickup(order)}\nE-mail: ${c.email}\nTelefoon: ${c.phone}\n\n${itemsText(order)}${order.message ? `\n\nOpmerking: ${order.message}` : ''}\n\nDashboard: ${siteUrl('/admin')}`,
  };
}

// ── 3. Customer: bevestigd ─────────────────────────────────────────────────
export function aanvraagBevestigd(order: FullOrder): RenderedEmail {
  const name = order.customer.firstname || 'daar';
  const body = [
    heading(`Joepie ${name}, het is in orde! 🎉`),
    paragraph(`Je aanvraag <strong>#${esc(order.id)}</strong> is bevestigd. ${esc(SITE.owner)} gaat met veel liefde voor je aan de slag.`),
    callout(`<strong>Ophalen:</strong> ${esc(pickup(order))}<br>${esc(fullAddress)}<br><span style="color:${COLORS.muted}">De bel van het atelier hangt aan de carport, naast het uithangbord.</span>`),
    itemsTable(order),
    button(directionsUrl, '📍 Route plannen in Google Maps'),
    paragraph(`Het resterende bedrag betaal je bij het ophalen, contant of met Payconiq. Te laat of verhinderd? Laat het even weten via ${esc(SITE.phone.display)}.`),
    paragraph(`<a href="${esc(siteUrl('/tips#bewaren'))}" style="color:${COLORS.pinkDark};font-weight:700">Tips om je taart mooi thuis te krijgen →</a>`),
  ].join('');
  return {
    subject: `Je aanvraag is bevestigd 🎉 (#${order.id})`,
    html: layout({ preheader: `Tot ${pickup(order)}!`, body }),
    text: `Joepie ${name}, het is in orde!\n\nJe aanvraag #${order.id} is bevestigd.\n\nOphalen: ${pickup(order)}\n${fullAddress}\nRoute: ${directionsUrl}\n\n${itemsText(order)}\n\nHet resterende bedrag betaal je bij het ophalen (contant of Payconiq).\nTips: ${siteUrl('/tips')}\n\n${contactText}`,
  };
}

// ── 4. Customer: niet mogelijk ─────────────────────────────────────────────
export function aanvraagGeweigerd(order: FullOrder): RenderedEmail {
  const name = order.customer.firstname || 'daar';
  const body = [
    heading(`Hoi ${name},`),
    paragraph(`Bedankt voor je aanvraag <strong>#${esc(order.id)}</strong> voor ${esc(pickup(order))}. Helaas lukt het ${esc(SITE.owner)} niet om deze aanvraag uit te voeren — vaak omdat de agenda op die dag al vol zit.`),
    paragraph(`Misschien past een andere datum wel? Bel gerust even naar <a href="${esc(SITE.phone.href)}" style="color:${COLORS.pinkDark}">${esc(SITE.phone.display)}</a> of dien een nieuwe aanvraag in — dan zoeken we samen een oplossing.`),
    button(siteUrl('/aanvraag'), 'Nieuwe aanvraag indienen'),
  ].join('');
  return {
    subject: `Over je aanvraag bij ${SITE.name} (#${order.id})`,
    html: layout({ preheader: 'Helaas lukt je aanvraag niet op deze datum — misschien een andere dag?', body }),
    text: `Hoi ${name},\n\nBedankt voor je aanvraag #${order.id} voor ${pickup(order)}. Helaas lukt het ${SITE.owner} niet om deze aanvraag uit te voeren.\n\nMisschien past een andere datum wel? Bel ${SITE.phone.display} of dien een nieuwe aanvraag in: ${siteUrl('/aanvraag')}\n\n${contactText}`,
  };
}
