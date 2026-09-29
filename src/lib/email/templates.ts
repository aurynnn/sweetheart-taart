// src/lib/email/templates.ts — The e-mails Sweetheart sends. Each returns subject + HTML + plain text.

import { SITE, fullAddress, directionsUrl } from '../../config/site';
import { itemPrice, itemSummary, productName, formatEuro, type AanvraagItem } from '../catalog';
import type { FullOrder } from '../orderRepo';
import { occasionLabel } from '../reminders';
import {
  COLORS, FONT, SCRIPT_FONT, button, callout, detailRows, emailAsset, esc, eyebrow, hearts, layout,
  mapsButton, paragraph, productImage, siteUrl, timeline,
} from './layout';

export interface RenderedEmail { subject: string; html: string; text: string }

const formatDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const pickup = (o: Pick<FullOrder, 'date' | 'time'>) => `${formatDate(o.date)}${o.time ? ` om ${o.time}` : ''}`;
const firstName = (o: FullOrder) => o.customer.firstname || 'daar';

function itemInfo(item: FullOrder['items'][number]) {
  const summary = itemSummary({ ...(item as AanvraagItem), quantity: item.product === 'feesttaart' ? undefined : item.quantity });
  return { name: productName(item.product), summary, price: item.price || itemPrice(item as AanvraagItem) };
}

/** The order as a "bon": product photo, details, price — dashed border like a ticket */
function ticket(order: FullOrder, forOwner = false): string {
  const rows = order.items.map((item) => {
    const { name, summary, price } = itemInfo(item);
    const extras = [
      item.allergies ? `<div style="margin-top:6px;display:inline-block;padding:3px 10px;border-radius:999px;background:#FFFBEB;color:#B45309;font-size:12px;font-weight:700">⚠ ${esc(item.allergies)}</div>` : '',
      item.message ? `<div style="margin-top:6px;color:${COLORS.muted};font-style:italic;font-size:13px">“${esc(item.message)}”</div>` : '',
      item.image
        ? forOwner
          ? `<div style="margin-top:6px"><a href="${esc(siteUrl(`/admin/api/upload?key=${encodeURIComponent(item.image)}`))}" style="color:${COLORS.pinkDark};font-size:13px;font-weight:700">📷 Voorbeeldfoto bekijken</a></div>`
          : `<div style="margin-top:6px;color:${COLORS.muted};font-size:13px">📷 Voorbeeldfoto ontvangen</div>`
        : '',
    ].join('');
    return `<tr>
      <td width="72" valign="top" style="padding:14px 0 14px 16px">
        <img src="${esc(productImage(item.product))}" alt="${esc(name)}" width="60" height="60" style="display:block;width:60px;height:60px;border-radius:14px;object-fit:cover;background:${COLORS.blush}">
      </td>
      <td valign="top" style="padding:14px 10px;font-family:${FONT};font-size:15px;color:${COLORS.ink}">
        <strong>${esc(name)}</strong><br><span style="font-size:13px;color:${COLORS.muted}">${esc(summary || 'Standaard')}</span>${extras}
      </td>
      <td valign="top" align="right" style="padding:14px 16px 14px 0;font-family:${FONT};font-size:15px;font-weight:800;color:${COLORS.pinkDark};white-space:nowrap">${esc(formatEuro(price))}</td>
    </tr>`;
  }).join(`<tr><td colspan="3" style="padding:0 16px"><div style="border-top:1px dashed ${COLORS.line}"></div></td></tr>`);
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;border:2px dashed ${COLORS.pinkLight};border-radius:18px;background:${COLORS.cream}">
    <tr><td colspan="3" style="padding:12px 16px 0;font-family:${FONT};font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${COLORS.pink}">${forOwner ? 'Aanvraag' : 'Jouw aanvraag'} · #${esc(order.id)}</td></tr>
    ${rows}
    <tr><td colspan="2" style="padding:12px 16px 16px;border-top:1px solid ${COLORS.line};font-family:${FONT};font-size:15px;color:${COLORS.ink}"><strong>Totaal</strong> <span style="font-size:12px;color:${COLORS.muted}">(indicatie)</span></td>
      <td align="right" style="padding:12px 16px 16px;border-top:1px solid ${COLORS.line};font-family:${FONT};font-size:20px;font-weight:800;color:${COLORS.pinkDark}">${esc(order.total)}</td></tr>
  </table>`;
}

function itemsText(order: FullOrder): string {
  return order.items.map((item) => {
    const { name, summary, price } = itemInfo(item);
    return `- ${name}${summary ? ` (${summary})` : ''}: ${formatEuro(price)}${item.allergies ? `\n  Allergieën: ${item.allergies}` : ''}${item.message ? `\n  Wensen: ${item.message}` : ''}`;
  }).join('\n') + `\nTotaal (indicatie): ${order.total}`;
}

const contactText = `${SITE.owner} — ${SITE.name}\n${fullAddress}\n${SITE.phone.display} · ${SITE.email}`;
const phoneLink = () => `<a href="${esc(SITE.phone.href)}" style="color:${COLORS.pinkDark};font-weight:700">${esc(SITE.phone.display)}</a>`;

// ── 1. Customer: aanvraag ontvangen ────────────────────────────────────────
export function aanvraagOntvangen(order: FullOrder): RenderedEmail {
  const body = [
    paragraph(`Hoi ${esc(firstName(order))}! 💕 Wat leuk dat je aan ons denkt. Je aanvraag is goed ontvangen — hieronder vind je een overzicht.`),
    callout('📅', `<strong>Ophalen</strong><br>${esc(pickup(order))}<br><span style="color:${COLORS.muted}">${esc(fullAddress)}</span>`),
    ticket(order),
    eyebrow('Wat gebeurt er nu?'),
    timeline([
      { title: 'Aanvraag ontvangen', text: 'Dat is gelukt!', state: 'done' },
      { title: `${SITE.owner} bekijkt je aanvraag`, text: 'Meestal binnen 1 à 2 werkdagen.', state: 'current' },
      { title: 'Je krijgt een bevestiging', text: 'Per mail, met de definitieve prijs.', state: 'next' },
      { title: 'Ophalen & smullen', text: pickup(order), state: 'next' },
    ]),
    paragraph(`Dit is een <strong>vrijblijvende aanvraag</strong> — je betaalt nu nog niets. Iets wijzigen of een vraag? Beantwoord gewoon deze mail of bel ${phoneLink()}.`),
    hearts(),
  ].join('');
  return {
    subject: `Joepie, je aanvraag is binnen! 🎂 (#${order.id})`,
    html: layout({
      preheader: `Ophalen op ${pickup(order)} — ${SITE.owner} neemt snel contact op.`,
      hero: { eyebrow: 'Aanvraag ontvangen', title: `Bedankt, ${firstName(order)}!`, subtitle: 'We gaan er iets moois van maken.', art: 'cupcake' },
      body,
    }),
    text: `Bedankt, ${firstName(order)}!\n\nWe hebben je aanvraag #${order.id} goed ontvangen.\n\nOphalen: ${pickup(order)}\n${fullAddress}\n\n${itemsText(order)}\n\n${SITE.owner} bekijkt je aanvraag en bevestigt meestal binnen 1 à 2 werkdagen, met de definitieve prijs. Je betaalt nu nog niets.\n\n${contactText}`,
  };
}

// ── 2. Owner: nieuwe aanvraag ──────────────────────────────────────────────
export function nieuweAanvraag(order: FullOrder): RenderedEmail {
  const c = order.customer;
  const who = [c.firstname, c.lastname].filter(Boolean).join(' ') || c.email;
  const hasAllergy = order.items.some((i) => i.allergies);
  const body = [
    paragraph(`<strong>${esc(who)}</strong> heeft zonet een aanvraag verstuurd${hasAllergy ? ' — <span style="color:#B45309;font-weight:800">⚠ met allergieën</span>' : ''}.`),
    detailRows([
      ['Ophalen', esc(pickup(order))],
      ['E-mail', `<a href="mailto:${esc(c.email)}" style="color:${COLORS.pinkDark}">${esc(c.email)}</a>`],
      ['Telefoon', `<a href="tel:${esc(c.phone.replace(/[^0-9+]/g, ''))}" style="color:${COLORS.pinkDark}">${esc(c.phone)}</a>`],
    ]),
    ticket(order, true),
    order.message ? callout('💬', `<strong>Opmerking van de klant</strong><br>${esc(order.message).replace(/\n/g, '<br>')}`) : '',
    button(siteUrl('/admin'), 'Bekijk & bevestig in het dashboard'),
    paragraph(`<span style="font-size:13px;color:${COLORS.muted}">Tip: beantwoord deze mail om de klant rechtstreeks te mailen.</span>`, 'text-align:center'),
  ].join('');
  return {
    subject: `🎂 Nieuwe aanvraag van ${who} — ${formatDate(order.date)}`,
    html: layout({
      preheader: `${who} · ophalen ${pickup(order)} · ${order.total}`,
      hero: { eyebrow: `Nieuwe aanvraag · #${order.id}`, title: 'Er is een nieuwe aanvraag!', subtitle: pickup(order) },
      body, signature: false, social: false,
    }),
    text: `Nieuwe aanvraag #${order.id} van ${who}\n\nOphalen: ${pickup(order)}\nE-mail: ${c.email}\nTelefoon: ${c.phone}\n\n${itemsText(order)}${order.message ? `\n\nOpmerking: ${order.message}` : ''}\n\nDashboard: ${siteUrl('/admin')}`,
  };
}

// ── 3. Customer: bevestigd ─────────────────────────────────────────────────
export function aanvraagBevestigd(order: FullOrder): RenderedEmail {
  const body = [
    paragraph(`Hoi ${esc(firstName(order))}, goed nieuws: je aanvraag is <strong>bevestigd</strong>! ${esc(SITE.owner)} gaat met veel liefde voor je aan de slag. 🎉`),
    callout('🗓️', `<strong>Tot ${esc(pickup(order))}</strong><br>${esc(fullAddress)}<br><span style="color:${COLORS.muted}">De bel van het atelier hangt aan de carport, naast het uithangbord.</span>`),
    mapsButton(directionsUrl, fullAddress),
    ticket(order),
    eyebrow('Handig om te weten'),
    timeline([
      { title: 'Aanvraag bevestigd', text: 'Je taart staat in de agenda.', state: 'done' },
      { title: 'Ophalen', text: `${pickup(order)} — betalen kan contant of met Payconiq.`, state: 'current' },
      { title: 'Genieten!', text: 'Haal je taart een half uurtje op voorhand uit de koelkast.', state: 'next' },
    ]),
    paragraph(`Te laat of verhinderd? Laat het even weten via ${phoneLink()}. <a href="${esc(siteUrl('/tips#bewaren'))}" style="color:${COLORS.pinkDark};font-weight:700">Bekijk onze tips</a> om je taart mooi thuis te krijgen.`),
    hearts(),
  ].join('');
  return {
    subject: `Het is in orde! Je aanvraag is bevestigd 🎉 (#${order.id})`,
    html: layout({
      preheader: `Tot ${pickup(order)}!`,
      hero: { eyebrow: 'Bevestigd', title: `Joepie, ${firstName(order)}!`, subtitle: `Ophalen: ${pickup(order)}`, art: 'cake' },
      body,
    }),
    text: `Joepie ${firstName(order)}, het is in orde!\n\nJe aanvraag #${order.id} is bevestigd.\n\nOphalen: ${pickup(order)}\n${fullAddress}\nRoute: ${directionsUrl}\n\n${itemsText(order)}\n\nHet resterende bedrag betaal je bij het ophalen (contant of Payconiq).\nTips: ${siteUrl('/tips')}\n\n${contactText}`,
  };
}

// ── 4. Customer: niet mogelijk ─────────────────────────────────────────────
export function aanvraagGeweigerd(order: FullOrder): RenderedEmail {
  const body = [
    paragraph(`Hoi ${esc(firstName(order))}, bedankt voor je aanvraag <strong>#${esc(order.id)}</strong> voor ${esc(pickup(order))}. Helaas lukt het ${esc(SITE.owner)} niet om deze aanvraag uit te voeren — vaak omdat de agenda op die dag al vol zit.`),
    callout('💡', `Misschien past een <strong>andere datum</strong> wel? Bel gerust even naar ${phoneLink()} of dien een nieuwe aanvraag in — dan zoeken we samen een oplossing.`),
    button(siteUrl('/aanvraag'), 'Kies een andere datum'),
    hearts(),
  ].join('');
  return {
    subject: `Over je aanvraag bij ${SITE.name} (#${order.id})`,
    html: layout({
      preheader: 'Helaas lukt je aanvraag niet op deze datum — misschien een andere dag?',
      hero: { eyebrow: `Aanvraag #${order.id}`, title: 'Oei, deze datum lukt niet', subtitle: 'Maar we denken graag mee over een andere dag.' },
      body,
    }),
    text: `Hoi ${firstName(order)},\n\nBedankt voor je aanvraag #${order.id} voor ${pickup(order)}. Helaas lukt het ${SITE.owner} niet om deze aanvraag uit te voeren.\n\nMisschien past een andere datum wel? Bel ${SITE.phone.display} of dien een nieuwe aanvraag in: ${siteUrl('/aanvraag')}\n\n${contactText}`,
  };
}

// ── 5. Customer: hoe was het? (review request) ─────────────────────────────
const STAR_LABELS = ['Niet goed', 'Matig', 'Oké', 'Lekker!', 'Geweldig!'];

export interface ReviewLinks { rating: (stars: number) => string; nextCake: string; unsubscribe: string }

export function reviewVerzoek(order: FullOrder, links: ReviewLinks): RenderedEmail {
  // One row of 5 stars; tapping star n gives n stars (5 → straight to Google reviews)
  const stars = [1, 2, 3, 4, 5].map((n) => `
    <td align="center" style="padding:0 2px">
      <a href="${esc(links.rating(n))}" title="${n} ster${n === 1 ? '' : 'ren'} — ${STAR_LABELS[n - 1]}" style="display:block;text-decoration:none">
        <img src="${esc(emailAsset(`star-${n}.gif`))}" alt="${n} ster${n === 1 ? '' : 'ren'}" width="52" height="52" style="display:block;width:52px;height:52px;border:0">
      </a>
    </td>`).join('');
  const body = [
    paragraph(`Hoi ${esc(firstName(order))}! We hopen dat je bestelling een echte blikvanger was en dat iedereen heeft gesmuld. 🎂`),
    paragraph(`Mogen we vragen hoe je het vond? <strong>Eén tik is genoeg:</strong>`, 'text-align:center'),
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px;border-radius:18px;background:${COLORS.blush}"><tr><td align="center" style="padding:18px 8px 16px">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto"><tr>${stars}</tr></table>
      <p style="margin:10px 0 0;font-family:${FONT};font-size:12px;color:${COLORS.muted}">Tik op het aantal sterren · 1 = niet goed, 5 = geweldig</p>
    </td></tr></table>`,
    paragraph(`<span style="font-size:13px;color:${COLORS.muted}">Je feedback helpt ${esc(SITE.owner)} om elke creatie nog mooier te maken. Bedankt! 💕</span>`, 'text-align:center'),
    hearts(),
    `<p style="margin:0 0 6px;font-family:${SCRIPT_FONT};font-size:28px;text-align:center;color:${COLORS.pinkDark}">Nog een feestje in zicht?</p>`,
    paragraph(`Vraag meteen je volgende taart aan, of laat ons je <strong>een maand op voorhand</strong> herinneren aan die verjaardag — dan ben je altijd op tijd.`, 'text-align:center'),
    button(links.nextCake, '🎂 Plan je volgende taart', 'light'),
  ].join('');
  return {
    subject: `Hoe was je taart, ${firstName(order)}? ⭐`,
    html: layout({
      preheader: 'Eén tik op de sterren — het duurt maar 2 seconden.',
      hero: { eyebrow: 'We zijn benieuwd!', title: 'Hoe was het?', subtitle: 'Vertel het ons in één tik', art: 'cupcake' },
      body,
      footerNote: `Liever geen mails meer zoals deze? <a href="${esc(links.unsubscribe)}" style="color:${COLORS.muted}">Uitschrijven</a>`,
    }),
    text: `Hoi ${firstName(order)}!\n\nWe hopen dat je hebt gesmuld. Hoe vond je je bestelling?\n${[1, 2, 3, 4, 5].map((n) => `${n} ster${n === 1 ? '' : 'ren'} (${STAR_LABELS[n - 1]}): ${links.rating(n)}`).join('\n')}\n\nPlan je volgende taart of stel een herinnering in: ${links.nextCake}\n\nUitschrijven: ${links.unsubscribe}\n\n${contactText}`,
  };
}

// ── 6–8. Reminders ("herinner me 1 maand op voorhand") ─────────────────────
export interface ReminderView { name: string | null; occasion: string; event_date: string; yearly: number }

const reminderWhat = (r: ReminderView) => `${occasionLabel(r.occasion).toLowerCase()}${r.name ? ` van ${r.name}` : ''}`;
const shortDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' });

/** Double opt-in: the address was typed on the website, so we ask to confirm it */
export function herinneringBevestigen(r: ReminderView, links: { confirm: string; cancel: string }): RenderedEmail {
  const body = [
    paragraph(`Hoi! Iemand (hopelijk jij 😊) vroeg om een herinnering voor de <strong>${esc(reminderWhat(r))}</strong> op ${esc(shortDate(r.event_date))}.`),
    paragraph(`Klik op de knop om te bevestigen. Zonder bevestiging sturen we niets.`),
    button(links.confirm, '✓ Ja, herinner me'),
    paragraph(`<span style="font-size:13px;color:${COLORS.muted}">Was jij dit niet? Dan mag je deze mail negeren of <a href="${esc(links.cancel)}" style="color:${COLORS.muted}">de aanvraag annuleren</a>.</span>`, 'text-align:center'),
  ].join('');
  return {
    subject: 'Bevestig je herinnering 🎂',
    html: layout({ preheader: 'Eén klik om je herinnering te bevestigen.', hero: { eyebrow: 'Herinnering', title: 'Nog één klikje!', subtitle: 'Bevestig je e-mailadres', art: 'bell' }, body, social: false }),
    text: `Bevestig je herinnering voor de ${reminderWhat(r)} (${shortDate(r.event_date)}): ${links.confirm}\n\nNiet aangevraagd? Negeer deze mail of annuleer: ${links.cancel}\n\n${contactText}`,
  };
}

export function herinneringIngesteld(r: ReminderView, links: { cancel: string }): RenderedEmail {
  const remindOn = new Date(r.event_date + 'T00:00:00'); remindOn.setDate(remindOn.getDate() - 30);
  const body = [
    paragraph(`Top! We sturen je een mailtje rond <strong>${esc(remindOn.toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' }))}</strong>, een maand voor de ${esc(reminderWhat(r))}. Zo heb je alle tijd om je taart aan te vragen.`),
    callout('🔔', `<strong>${esc(occasionLabel(r.occasion))}${r.name ? ` · ${esc(r.name)}` : ''}</strong><br>${esc(shortDate(r.event_date))}${r.yearly ? '<br><span style="color:' + COLORS.muted + '">We herinneren je elk jaar opnieuw.</span>' : ''}`),
    paragraph(`<span style="font-size:13px;color:${COLORS.muted}">Toch niet meer nodig? <a href="${esc(links.cancel)}" style="color:${COLORS.muted}">Herinnering annuleren</a>.</span>`, 'text-align:center'),
    hearts(),
  ].join('');
  return {
    subject: 'Je herinnering staat klaar 🔔',
    html: layout({ preheader: `We laten je een maand op voorhand iets weten.`, hero: { eyebrow: 'Herinnering ingesteld', title: 'Afgesproken!', subtitle: 'Wij denken eraan, jij geniet.', art: 'bell' }, body }),
    text: `Je herinnering voor de ${reminderWhat(r)} (${shortDate(r.event_date)}) staat klaar. We mailen je een maand op voorhand.\n\nAnnuleren: ${links.cancel}\n\n${contactText}`,
  };
}

export function herinnering(r: ReminderView, links: { order: string; cancel: string; unsubscribe: string }): RenderedEmail {
  const body = [
    paragraph(`Hoi! Je vroeg ons om je te herinneren: over ongeveer een maand is het de <strong>${esc(reminderWhat(r))}</strong> (${esc(shortDate(r.event_date))}). 🎉`),
    paragraph(`De agenda loopt snel vol — vraag je taart dus op tijd aan. We maken er samen iets onvergetelijks van!`),
    button(links.order, '🎂 Vraag nu je taart aan'),
    hearts(),
  ].join('');
  return {
    subject: `Over een maand: ${reminderWhat(r)} 🎂`,
    html: layout({
      preheader: 'Vraag je taart op tijd aan — de agenda loopt snel vol.',
      hero: { eyebrow: 'Jouw herinnering', title: `Bijna ${occasionLabel(r.occasion).toLowerCase()}!`, subtitle: r.name ? `Voor ${r.name}` : undefined, art: 'bell' },
      body,
      footerNote: `${r.yearly ? 'Je krijgt deze herinnering elk jaar. ' : ''}<a href="${esc(links.cancel)}" style="color:${COLORS.muted}">Herinnering stoppen</a> · <a href="${esc(links.unsubscribe)}" style="color:${COLORS.muted}">Uitschrijven</a>`,
    }),
    text: `Over ongeveer een maand is het de ${reminderWhat(r)} (${shortDate(r.event_date)}). Vraag je taart op tijd aan: ${links.order}\n\nHerinnering stoppen: ${links.cancel}\nUitschrijven: ${links.unsubscribe}\n\n${contactText}`,
  };
}
