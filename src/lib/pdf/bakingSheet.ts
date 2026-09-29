// src/lib/pdf/bakingSheet.ts — Printable "te maken" sheet (A4) for the kitchen.
//
//   ┌ pink header: Sweetheart · Te maken · period ──────────────┐
//   │ summary: orders per day + totals per product              │
//   ├ one card per aanvraag ───────────────────────────────────┤
//   │ time + date | customer + phone              | photo      │
//   │ products table · allergies (amber) · notes               │
//   │ ☐ gebakken ☐ versierd ☐ verpakt ☐ opgehaald              │
//   └ footer: page x / y ───────────────────────────────────────┘

// Standalone build: the standard fonts are bundled in (a Worker has no filesystem)
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';
import { SITE } from '../../config/site';
import { LOCALE, TIME_ZONE } from '../dates';
import { productName, itemSummary, type AanvraagItem } from '../catalog';
import type { FullOrder } from '../orderRepo';

type Doc = InstanceType<typeof PDFDocument>;

const C = {
  pink: '#E8788A', pinkDark: '#D45A6A', blush: '#FDEEF0', ink: '#1E293B', muted: '#64748B',
  line: '#E2E8F0', amberBg: '#FFFBEB', amber: '#B45309', white: '#FFFFFF',
};
const PAGE = { w: 595.28, h: 841.89, m: 40 };
const CONTENT_W = PAGE.w - PAGE.m * 2;
const PHOTO = 110;

const fmtDay = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' });
const customerName = (o: FullOrder) => [o.customer.firstname, o.customer.lastname].filter(Boolean).join(' ') || 'Onbekend';

/** Photos are fetched by the caller (R2); key → JPEG/PNG buffer */
export type PhotoMap = Map<string, Buffer>;

export function renderBakingSheet(orders: FullOrder[], photos: PhotoMap): Doc {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE.m, bufferPages: true, info: { Title: `${SITE.name} — te maken`, Author: SITE.name } });
  const sorted = [...orders].sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));

  let y = header(doc, sorted);
  y = summary(doc, sorted, y);
  for (const order of sorted) y = card(doc, order, photos, y);

  footer(doc);
  return doc;
}

function header(doc: Doc, orders: FullOrder[]): number {
  doc.rect(0, 0, PAGE.w, 92).fill(C.pink);
  doc.fillColor(C.white).font('Helvetica-Bold').fontSize(26).text(SITE.name, PAGE.m, 26);
  doc.font('Helvetica').fontSize(10).fillColor('#FFE4EA').text(SITE.tagline.toUpperCase(), PAGE.m, 58, { characterSpacing: 1.5 });

  const first = orders[0]?.date, last = orders[orders.length - 1]?.date;
  const period = !first ? '' : first === last ? fmtDay(first) : `${fmtDay(first)} – ${fmtDay(last!)}`;
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.white).text('Te maken', PAGE.m, 28, { width: CONTENT_W, align: 'right' });
  doc.font('Helvetica').fontSize(10).fillColor('#FFE4EA').text(period, PAGE.m, 48, { width: CONTENT_W, align: 'right' });
  doc.fontSize(8).text(`Afgedrukt op ${new Date().toLocaleString(LOCALE, { timeZone: TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' })}`, PAGE.m, 64, { width: CONTENT_W, align: 'right' });
  return 112;
}

function summary(doc: Doc, orders: FullOrder[], y: number): number {
  const perProduct = new Map<string, number>();
  for (const o of orders) for (const i of o.items) {
    const n = i.product === 'feesttaart' ? 1 : Number(i.quantity) || 1;
    perProduct.set(i.product, (perProduct.get(i.product) ?? 0) + n);
  }
  const perDay = new Map<string, number>();
  for (const o of orders) perDay.set(o.date, (perDay.get(o.date) ?? 0) + 1);

  const boxH = 70;
  doc.roundedRect(PAGE.m, y, CONTENT_W, boxH, 10).fill(C.blush);
  const colW = CONTENT_W / 3;
  const stat = (x: number, label: string, value: string) => {
    doc.fillColor(C.muted).font('Helvetica-Bold').fontSize(8).text(label.toUpperCase(), x, y + 14, { width: colW - 20, characterSpacing: 0.8 });
    doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(11).text(value, x, y + 28, { width: colW - 20, lineGap: 1 });
  };
  stat(PAGE.m + 16, 'Aanvragen', `${orders.length} op ${perDay.size} dag${perDay.size === 1 ? '' : 'en'}`);
  stat(PAGE.m + colW, 'Producten', [...perProduct].map(([p, n]) => p === 'feesttaart' ? `${n}× ${productName(p)}` : `${n} ${productName(p).toLowerCase()}`).join('\n') || '—');
  const allergyCount = orders.filter((o) => o.items.some((i) => i.allergies)).length;
  stat(PAGE.m + colW * 2, 'Let op', allergyCount ? `${allergyCount} met allergieën` : 'Geen allergieën');
  return y + boxH + 18;
}

function measureCard(doc: Doc, order: FullOrder, hasPhoto: boolean): number {
  const textW = CONTENT_W - 32 - (hasPhoto ? PHOTO + 16 : 0);
  doc.font('Helvetica').fontSize(9.5);
  let h = 62; // top row
  for (const i of order.items) {
    h += Math.max(18, doc.heightOfString(itemSummary(i as AanvraagItem) || 'Standaard', { width: textW - 150 }) + 8);
    if (i.allergies) h += doc.heightOfString(`Allergieën: ${i.allergies}`, { width: textW - 16 }) + 12;
    if (i.message) h += doc.heightOfString(`Wensen: ${i.message}`, { width: textW }) + 6;
  }
  if (order.message) h += doc.heightOfString(order.message, { width: textW - 16 }) + 22;
  h += 40; // checklist
  return Math.max(h, hasPhoto ? PHOTO + 80 : 0);
}

function card(doc: Doc, order: FullOrder, photos: PhotoMap, y: number): number {
  const photoKey = order.items.find((i) => i.image && photos.has(i.image))?.image;
  const h = measureCard(doc, order, !!photoKey);
  if (y + h > PAGE.h - PAGE.m - 24) { doc.addPage(); y = PAGE.m; }

  const x = PAGE.m;
  const hasAllergy = order.items.some((i) => i.allergies);
  doc.roundedRect(x, y, CONTENT_W, h, 10).lineWidth(1).strokeColor(C.line).stroke();
  doc.rect(x, y + 10, 4, h - 20).fill(hasAllergy ? C.amber : C.pink);

  const inner = x + 16;
  const textW = CONTENT_W - 32 - (photoKey ? PHOTO + 16 : 0);

  // Top row: time badge + customer
  doc.roundedRect(inner, y + 14, 64, 36, 8).fill(C.blush);
  doc.fillColor(C.pinkDark).font('Helvetica-Bold').fontSize(14).text(order.time ?? '—', inner, y + 20, { width: 64, align: 'center' });
  doc.fillColor(C.muted).font('Helvetica').fontSize(7).text(new Date(order.date + 'T00:00:00').toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' }), inner, y + 37, { width: 64, align: 'center' });

  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(12).text(customerName(order), inner + 76, y + 16, { width: textW - 76 });
  doc.fillColor(C.muted).font('Helvetica').fontSize(9).text(`#${order.id}  ·  ${order.customer.phone || ''}  ·  ${order.total}`, inner + 76, y + 33, { width: textW - 76 });

  // Products
  let cy = y + 62;
  for (const item of order.items) {
    const qty = item.product === 'feesttaart' ? '1×' : `${item.quantity ?? ''}×`;
    doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(10).text(`${qty} ${productName(item.product)}`, inner, cy, { width: 140 });
    const detail = itemSummary({ ...(item as AanvraagItem), quantity: undefined }) || 'Standaard';
    doc.fillColor(C.muted).font('Helvetica').fontSize(9.5).text(detail, inner + 150, cy, { width: textW - 150 });
    cy += Math.max(18, doc.heightOfString(detail, { width: textW - 150 }) + 8);

    if (item.allergies) {
      const t = `Allergieën: ${item.allergies}`;
      const th = doc.heightOfString(t, { width: textW - 16 });
      doc.roundedRect(inner, cy - 2, textW, th + 8, 5).fill(C.amberBg);
      doc.fillColor(C.amber).font('Helvetica-Bold').fontSize(9.5).text(t, inner + 8, cy + 2, { width: textW - 16 });
      cy += th + 12;
    }
    if (item.message) {
      doc.fillColor(C.ink).font('Helvetica-Oblique').fontSize(9.5).text(`Wensen: ${item.message}`, inner, cy, { width: textW });
      cy += doc.heightOfString(`Wensen: ${item.message}`, { width: textW }) + 6;
    }
  }

  if (order.message) {
    const th = doc.heightOfString(order.message, { width: textW - 16 });
    doc.roundedRect(inner, cy + 2, textW, th + 16, 6).fill('#F8FAFC');
    doc.fillColor(C.muted).font('Helvetica-Bold').fontSize(7).text('NOTITIE', inner + 8, cy + 7);
    doc.fillColor(C.ink).font('Helvetica').fontSize(9.5).text(order.message, inner + 8, cy + 15, { width: textW - 16 });
    cy += th + 22;
  }

  // Workflow checkboxes
  const checks = ['gebakken', 'versierd', 'verpakt', 'opgehaald'];
  const cyBox = y + h - 28;
  checks.forEach((label, i) => {
    const bx = inner + i * 95;
    doc.roundedRect(bx, cyBox, 11, 11, 2).lineWidth(1).strokeColor(C.pink).stroke();
    doc.fillColor(C.muted).font('Helvetica').fontSize(9).text(label, bx + 16, cyBox + 1);
  });

  // Photo
  if (photoKey) {
    const px = x + CONTENT_W - 16 - PHOTO;
    try {
      doc.save();
      doc.roundedRect(px, y + 14, PHOTO, PHOTO, 8).clip();
      doc.image(photos.get(photoKey)!, px, y + 14, { cover: [PHOTO, PHOTO], align: 'center', valign: 'center' });
      doc.restore();
      doc.fillColor(C.muted).font('Helvetica').fontSize(7).text('voorbeeldfoto', px, y + 18 + PHOTO, { width: PHOTO, align: 'center' });
    } catch {
      doc.restore();
    }
  }

  return y + h + 14;
}

function footer(doc: Doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // writing inside the margin must not trigger a new page
    doc.fillColor(C.muted).font('Helvetica').fontSize(8)
      .text(`${SITE.name} · ${SITE.phone.display}`, PAGE.m, PAGE.h - 30, { width: CONTENT_W / 2, lineBreak: false })
      .text(`Pagina ${i - range.start + 1} / ${range.count}`, PAGE.m + CONTENT_W / 2, PAGE.h - 30, { width: CONTENT_W / 2, align: 'right', lineBreak: false });
  }
}
