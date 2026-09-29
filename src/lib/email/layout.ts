// src/lib/email/layout.ts — Branded e-mail shell + building blocks.
// E-mail clients (Gmail, Outlook) ignore <style> blocks, animations and flexbox,
// so everything here is table-based with inline styles. Images must be hosted
// publicly (R2), and every image has alt text for clients that block images.

import { SITE, fullAddress, EMAIL_IMAGES } from '../../config/site';
import { env } from '../env';

export const COLORS = {
  pink: '#E8788A',
  pinkDark: '#D45A6A',
  pinkLight: '#F2A0AA',
  blush: '#FDEEF0',
  cream: '#FFF7F8',
  ink: '#4A3A3D',
  muted: '#7A6A6D',
  line: '#F0E0E2',
  bg: '#F6E3E5',
  gold: '#F5B83D',
};

export const FONT = `'Nunito Sans', 'Segoe UI', Helvetica, Arial, sans-serif`;
export const SCRIPT_FONT = `'Caveat', 'Segoe Script', 'Brush Script MT', cursive`;

export const siteUrl = (path = '') => `${(env('SITE_URL') || SITE.url).replace(/\/$/, '')}${path}`;
export const imageUrl = (key: string) => `${(env('PUBLIC_R2_BASE_URL') || '').replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
/** Artwork from public/email/ (uploaded to R2 by `npm run upload:email-assets`).
 *  Bump ASSET_VERSION after regenerating, so mail clients' image caches refresh. */
const ASSET_VERSION = '4';
export const emailAsset = (file: string) => `${imageUrl(`email-assets/${file}`)}?v=${ASSET_VERSION}`;

export const productImage = (product: string) => imageUrl(EMAIL_IMAGES.products[product] ?? EMAIL_IMAGES.products.feesttaart);

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const table = (inner: string, style = '') =>
  `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;${style}">${inner}</table>`;

export const paragraph = (html: string, style = '') =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.65;color:${COLORS.ink};${style}">${html}</p>`;

export const eyebrow = (text: string) =>
  `<p style="margin:0 0 6px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${COLORS.pink}">${esc(text)}</p>`;

export const heading = (text: string, size = 30) =>
  `<h2 style="margin:0 0 14px;font-family:${SCRIPT_FONT};font-size:${size}px;line-height:1.15;font-weight:700;color:${COLORS.pinkDark}">${esc(text)}</h2>`;

export const button = (href: string, label: string, variant: 'primary' | 'light' = 'primary') => {
  const bg = variant === 'primary' ? COLORS.pink : '#ffffff';
  const color = variant === 'primary' ? '#ffffff' : COLORS.pinkDark;
  const gradient = variant === 'primary' ? `background-image:linear-gradient(135deg,${COLORS.pinkLight},${COLORS.pink} 55%,${COLORS.pinkDark});` : '';
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:6px auto 22px">
    <tr><td align="center" style="border-radius:999px;background:${bg};${gradient}box-shadow:0 10px 24px -10px rgba(212,90,106,0.7)">
      <a href="${esc(href)}" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:16px;font-weight:800;color:${color};text-decoration:none;border-radius:999px">${esc(label)}</a>
    </td></tr>
  </table>`;
};

/**
 * Pickup card: when + where, with a clear full-width "Route plannen" row.
 * Text is allowed to wrap, so nothing overflows on small phones.
 */
export const pickupCard = (opts: { when: string; address: string; note?: string; directionsHref: string }) => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;border-collapse:separate;border-radius:18px;background:${COLORS.blush};border:1px solid ${COLORS.line}">
    <tr><td style="padding:18px 20px 14px;font-family:${FONT};color:${COLORS.ink}">
      <p style="margin:0 0 2px;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${COLORS.pink}">Ophalen</p>
      <p style="margin:0 0 6px;font-size:17px;font-weight:800;line-height:1.35">${esc(opts.when)}</p>
      <p style="margin:0;font-size:14px;line-height:1.5;color:${COLORS.muted}">${esc(opts.address)}${opts.note ? `<br>${esc(opts.note)}` : ''}</p>
    </td></tr>
    <tr><td style="padding:0 12px 12px">
      <a href="${esc(opts.directionsHref)}" style="display:block;text-decoration:none;border-radius:12px;background:#ffffff;border:1px solid ${COLORS.line}">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
          <td width="44" valign="middle" style="padding:8px 0 8px 10px"><img src="${esc(emailAsset('maps.png'))}" alt="" width="30" height="30" style="display:block;width:30px;height:30px;border:0"></td>
          <td valign="middle" style="padding:8px 6px;font-family:${FONT};font-size:15px;font-weight:800;color:${COLORS.ink}">Route plannen <span style="font-weight:600;color:${COLORS.muted};font-size:13px">in Google Maps</span></td>
          <td width="30" valign="middle" align="right" style="padding:8px 14px 8px 0;font-family:${FONT};font-size:18px;font-weight:800;color:${COLORS.pink}">&rarr;</td>
        </tr></table>
      </a>
    </td></tr>
  </table>`;

/** Soft pink box with an icon, e.g. pickup details */
export const callout = (icon: string, html: string) =>
  table(`<tr>
    <td width="46" valign="top" style="padding:18px 0 18px 18px;font-size:24px;line-height:1">${icon}</td>
    <td style="padding:18px 20px 18px 10px;font-family:${FONT};font-size:15px;line-height:1.6;color:${COLORS.ink}">${html}</td>
  </tr>`, `margin:0 0 22px;border-radius:16px;background:${COLORS.blush}`);

/** Two-column label/value rows */
export const detailRows = (rows: Array<[string, string]>) =>
  table(rows.map(([label, value]) => `
    <tr>
      <td style="padding:10px 12px 10px 0;border-bottom:1px solid ${COLORS.line};font-family:${FONT};font-size:14px;color:${COLORS.muted};width:34%;vertical-align:top">${esc(label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid ${COLORS.line};font-family:${FONT};font-size:14px;font-weight:700;color:${COLORS.ink};vertical-align:top">${value}</td>
    </tr>`).join(''), 'margin:0 0 22px;border-collapse:collapse');

/** Vertical timeline: done / current / next */
export const timeline = (items: Array<{ title: string; text: string; state: 'done' | 'current' | 'next' }>) =>
  table(items.map((it, i) => {
    const dot = it.state === 'done'
      ? `<div style="width:30px;height:30px;border-radius:15px;background:#22C55E;color:#fff;font-family:${FONT};font-size:15px;font-weight:800;line-height:30px;text-align:center">✓</div>`
      : `<div style="width:30px;height:30px;border-radius:15px;background:${it.state === 'current' ? COLORS.pink : '#ffffff'};border:2px solid ${COLORS.pink};color:${it.state === 'current' ? '#fff' : COLORS.pink};font-family:${FONT};font-size:14px;font-weight:800;line-height:26px;text-align:center;box-sizing:border-box">${i + 1}</div>`;
    const line = i < items.length - 1 ? `<div style="width:2px;height:22px;margin:4px auto 0;background:${COLORS.line}"></div>` : '';
    return `<tr>
      <td width="44" valign="top" style="padding:0">${dot}${line}</td>
      <td valign="top" style="padding:4px 0 14px;font-family:${FONT};font-size:15px;line-height:1.45;color:${COLORS.ink}">
        <strong>${esc(it.title)}</strong><br><span style="color:${COLORS.muted};font-size:14px">${esc(it.text)}</span>
      </td>
    </tr>`;
  }).join(''), 'margin:0 0 18px');

/** Decorative divider */
export const hearts = () =>
  `<p style="margin:6px 0 22px;text-align:center;font-size:14px;letter-spacing:10px;color:${COLORS.pinkLight}">♥ ♥ ♥</p>`;

/** Instagram / Facebook invitation with the real logos (hosted PNGs — e-mail clients don't render SVG) */
export const socialBlock = () => {
  const icon = (href: string, file: string, label: string) =>
    `<a href="${esc(href)}" style="display:inline-block;margin:0 8px;text-decoration:none" title="${esc(label)}">
      <img src="${esc(emailAsset(file))}" alt="${esc(label)}" width="40" height="40" style="display:block;width:40px;height:40px;border:0">
    </a>`;
  return table(`<tr><td align="center" style="padding:24px 20px;border-radius:18px;background:${COLORS.cream};border:1px dashed ${COLORS.pinkLight}">
    <p style="margin:0 0 4px;font-family:${SCRIPT_FONT};font-size:26px;font-weight:700;color:${COLORS.pinkDark}">Zin in meer inspiratie?</p>
    <p style="margin:0 0 16px;font-family:${FONT};font-size:14px;color:${COLORS.muted}">Volg ons voor de nieuwste taarten, koekjes en mini's.</p>
    ${icon(SITE.social.instagram, 'instagram.png', 'Instagram')}${icon(SITE.social.facebook, 'facebook.png', 'Facebook')}
  </td></tr>`, 'margin:8px 0 24px');
};

export type HeroArt = 'cupcake' | 'cake' | 'bell' | 'slice';

interface HeroOptions {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Small looping animation in a white round "sticker" (see scripts/email-art) */
  art?: HeroArt;
}

const ART_ALT: Record<HeroArt, string> = {
  cupcake: 'Cupcake met hartjes', cake: 'Feesttaart met kaarsjes', bell: 'Herinneringsbelletje', slice: 'Stukje taart',
};

/** Compact pink header like the website: logo, small animated sticker, title */
function hero({ eyebrow: eb, title, subtitle, art }: HeroOptions) {
  const bg = `background-color:#DC9A9E;background-image:url('${emailAsset('pattern.png')}'),linear-gradient(160deg,#D48F93 0%,#E1A0A4 55%,#EDB4B7 100%);background-size:240px 240px,auto`;
  return `
  <tr><td style="padding:0;border-radius:24px 24px 0 0;${bg}">
    ${table(`<tr><td align="center" style="padding:18px 20px 0">
      <a href="${esc(siteUrl('/'))}" style="text-decoration:none">
        <span style="font-family:${SCRIPT_FONT};font-size:28px;font-weight:700;color:#ffffff">${esc(SITE.name)}</span>
      </a>
    </td></tr>
    ${art ? `<tr><td align="center" style="padding:12px 20px 0">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="width:120px;height:120px;border-radius:60px;background:#ffffff;box-shadow:0 14px 30px -14px rgba(90,30,40,0.55)">
        <img src="${esc(emailAsset(`anim-${art}.gif`))}" alt="${esc(ART_ALT[art])}" width="112" height="112" style="display:block;width:112px;height:112px;margin:4px;border:0;border-radius:56px">
      </td></tr></table>
    </td></tr>` : ''}
    <tr><td align="center" style="padding:12px 24px 20px">
      <p style="margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#ffffff;opacity:0.9">${esc(eb)}</p>
      <h1 style="margin:0;font-family:${SCRIPT_FONT};font-size:32px;line-height:1.1;font-weight:700;color:#ffffff">${esc(title)}</h1>
      ${subtitle ? `<p style="margin:6px 0 0;font-family:${FONT};font-size:14px;line-height:1.45;color:#3D272A">${esc(subtitle)}</p>` : ''}
    </td></tr>`)}
  </td></tr>`;
}

export function layout({ preheader, hero: heroOptions, body, signature = true, social = true, footerNote }: {
  preheader: string;
  hero: HeroOptions;
  body: string;
  signature?: boolean;
  social?: boolean;
  /** Extra small print, e.g. an unsubscribe link for marketing mails */
  footerNote?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${esc(SITE.name)}</title>
  <style>
    /* Star rating: the row is written right-to-left, so "hovered star + the ones after it in
       the code" are the hovered star and everything to its left → highlights 1…N on hover.
       Mail apps without support simply show 5 static stars. */
    .rate:hover .star img { opacity: 0.35; }
    .rate .star:hover img, .rate .star:hover ~ .star img { opacity: 1; }
    .rate .star:hover img { transform: scale(1.18); }
    .rate .star img { transition: opacity .15s ease, transform .15s ease; }
  </style>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
  ${table(`<tr><td align="center" style="padding:28px 12px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px">
      ${hero(heroOptions)}
      <tr><td style="padding:32px 30px 8px;background:#ffffff">
        ${body}
        ${social ? socialBlock() : ''}
      </td></tr>
      <tr><td style="padding:22px 30px 30px;background:#ffffff;border-top:1px solid ${COLORS.line};border-radius:0 0 24px 24px;font-family:${FONT};font-size:13px;line-height:1.7;color:${COLORS.muted};text-align:center">
        ${signature ? `<span style="font-family:${SCRIPT_FONT};font-size:22px;color:${COLORS.pinkDark}">Met lieve groetjes, ${esc(SITE.owner)}</span><br>` : ''}
        ${esc(fullAddress)} · <a href="${esc(SITE.phone.href)}" style="color:${COLORS.pinkDark};text-decoration:none">${esc(SITE.phone.display)}</a><br>
        <a href="${esc(siteUrl('/tips'))}" style="color:${COLORS.pinkDark}">Ophaalinfo & tips</a> ·
        <a href="${esc(siteUrl('/algemene-voorwaarden'))}" style="color:${COLORS.pinkDark}">Algemene voorwaarden</a> ·
        <a href="${esc(siteUrl('/privacy'))}" style="color:${COLORS.pinkDark}">Privacy</a>
        ${footerNote ? `<br><span style="font-size:12px">${footerNote}</span>` : ''}
      </td></tr>
      <tr><td align="center" style="padding:16px;font-family:${FONT};font-size:11px;color:${COLORS.muted}">
        Met liefde gebakken in ${esc(SITE.address.city)} ♥
      </td></tr>
    </table>
  </td></tr>`, `background:${COLORS.bg}`)}
</body>
</html>`;
}
