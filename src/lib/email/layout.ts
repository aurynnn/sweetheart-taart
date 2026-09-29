// src/lib/email/layout.ts — Branded e-mail shell + small building blocks.
// E-mail clients (Gmail, Outlook) ignore <style> blocks, animations and flexbox,
// so everything here is table-based with inline styles.

import { SITE, fullAddress } from '../../config/site';
import { env } from '../env';

export const COLORS = {
  pink: '#E8788A',
  pinkDark: '#D45A6A',
  blush: '#FDEEF0',
  ink: '#4A3A3D',
  muted: '#7A6A6D',
  line: '#F0E0E2',
  bg: '#FFF5F7',
};

const FONT = `'Nunito Sans', 'Segoe UI', Helvetica, Arial, sans-serif`;
const SCRIPT_FONT = `'Caveat', 'Brush Script MT', 'Segoe Script', cursive`;

export const siteUrl = (path = '') => `${(env('SITE_URL') || SITE.url).replace(/\/$/, '')}${path}`;

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const paragraph = (html: string) =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${COLORS.ink}">${html}</p>`;

export const heading = (text: string) =>
  `<h1 style="margin:0 0 12px;font-family:${SCRIPT_FONT};font-size:34px;line-height:1.15;font-weight:700;color:${COLORS.pinkDark}">${esc(text)}</h1>`;

export const button = (href: string, label: string) => `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 24px">
    <tr><td style="border-radius:999px;background:${COLORS.pink}">
      <a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${esc(label)}</a>
    </td></tr>
  </table>`;

/** Soft pink box, e.g. for pickup details or a highlighted note */
export const callout = (html: string) => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px">
    <tr><td style="padding:18px 20px;border-radius:14px;background:${COLORS.blush};font-family:${FONT};font-size:15px;line-height:1.6;color:${COLORS.ink}">${html}</td></tr>
  </table>`;

/** Two-column label/value rows */
export const detailRows = (rows: Array<[string, string]>) => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;border-collapse:collapse">
    ${rows.map(([label, value]) => `
      <tr>
        <td style="padding:8px 12px 8px 0;border-bottom:1px solid ${COLORS.line};font-family:${FONT};font-size:14px;color:${COLORS.muted};width:38%;vertical-align:top">${esc(label)}</td>
        <td style="padding:8px 0;border-bottom:1px solid ${COLORS.line};font-family:${FONT};font-size:14px;font-weight:600;color:${COLORS.ink};vertical-align:top">${value}</td>
      </tr>`).join('')}
  </table>`;

/** Numbered "wat nu?" steps */
export const steps = (items: Array<[string, string]>) => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px">
    ${items.map(([title, text], i) => `
      <tr>
        <td style="width:40px;padding:6px 0;vertical-align:top">
          <div style="width:28px;height:28px;border-radius:14px;background:${COLORS.pink};color:#fff;font-family:${FONT};font-size:14px;font-weight:700;line-height:28px;text-align:center">${i + 1}</div>
        </td>
        <td style="padding:6px 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${COLORS.ink}">
          <strong>${esc(title)}</strong><br><span style="color:${COLORS.muted}">${esc(text)}</span>
        </td>
      </tr>`).join('')}
  </table>`;

export function layout({ preheader, body, signature = true }: { preheader: string; body: string; signature?: boolean }): string {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${esc(SITE.name)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLORS.bg}">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px">
        <tr><td align="center" style="padding:28px 24px;border-radius:20px 20px 0 0;background:${COLORS.pink};background-image:linear-gradient(135deg,#F2A0AA,#E8788A 55%,#D45A6A)">
          <a href="${esc(siteUrl('/'))}" style="text-decoration:none">
            <span style="font-family:${SCRIPT_FONT};font-size:40px;font-weight:700;color:#ffffff">${esc(SITE.name)}</span><br>
            <span style="font-family:${FONT};font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#ffe9ee">${esc(SITE.tagline)}</span>
          </a>
        </td></tr>
        <tr><td style="padding:32px 28px 12px;background:#ffffff;border-left:1px solid ${COLORS.line};border-right:1px solid ${COLORS.line}">
          ${body}
        </td></tr>
        <tr><td style="padding:22px 28px 28px;background:#ffffff;border:1px solid ${COLORS.line};border-top:0;border-radius:0 0 20px 20px;font-family:${FONT};font-size:13px;line-height:1.6;color:${COLORS.muted}">
          ${signature ? `Met lieve groetjes,<br><strong style="color:${COLORS.ink}">${esc(SITE.owner)} — ${esc(SITE.name)}</strong><br>` : ''}
          ${esc(fullAddress)} · <a href="${esc(SITE.phone.href)}" style="color:${COLORS.pinkDark};text-decoration:none">${esc(SITE.phone.display)}</a><br>
          <a href="${esc(siteUrl('/tips'))}" style="color:${COLORS.pinkDark}">Ophaalinfo & tips</a> ·
          <a href="${esc(siteUrl('/algemene-voorwaarden'))}" style="color:${COLORS.pinkDark}">Algemene voorwaarden</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
