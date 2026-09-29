// src/lib/orders.ts — Shared order rendering helpers for the admin panel

import { EVENTS, FLAVORS, MINI_TYPES, TOPPERS, optionLabel, productName } from './catalog';

export interface OrderItem {
  product?: string;
  event?: string;
  miniType?: string;
  quantity?: number;
  persons?: string | number;
  flavor?: string;
  topper?: string;
  allergies?: string;
  message?: string;
  price?: number;
  image?: string;
}

export interface OrderCustomer {
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
}

export interface Order {
  id: string;
  date?: string;
  time?: string;
  status: string;
  customer?: OrderCustomer;
  items?: OrderItem[];
  total?: string;
  totalValue?: number;
  message?: string;
  createdAt?: string;
}

/** Escape customer-provided text before it goes into innerHTML. */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const photoUrl = (key: string) => `/admin/api/upload?key=${encodeURIComponent(key)}`;

function photoHtml(key: string): string {
  return `<a class="example-photo" href="${esc(photoUrl(key))}" target="_blank" rel="noopener" title="Voorbeeldfoto openen">
    <img src="${esc(photoUrl(key))}" alt="Voorbeeldfoto van de klant" loading="lazy"
      style="width:100%;max-height:220px;object-fit:cover;border-radius:0.75rem;margin-top:0.5rem;display:block" />
    <span style="font-size:0.75rem;color:#64748b">📷 Voorbeeldfoto — klik om te vergroten</span>
  </a>`;
}

/** Notes stored before migrations/0006 contain the photo link as text — show it as a photo. */
function linkPhotos(escapedText: string): string {
  return escapedText.replace(/\/admin\/api\/upload\?key=(aanvragen\/[0-9]{4}-[0-9]{2}\/[0-9a-f-]{36}\.(?:jpg|png|webp))/g, (_m, key) => photoHtml(key));
}

export function formatPickup(order: Pick<Order, 'date' | 'time'>): string {
  if (!order.date) return '';
  const d = new Date(order.date + 'T00:00:00');
  const day = isNaN(d.getTime())
    ? order.date
    : d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return order.time ? `${day} · ${order.time}` : day;
}

// ── Render ───────────────────────────────────────────────────────────────────

export function renderOrderDetail(order: Order): string {
  const c = order.customer || {};
  const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const fullName = [c.firstname, c.lastname].filter(Boolean).join(' ');

  // Customer avatar initials
  const initials = (fullName || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  const itemsHtml = (order.items || []).map((item, i) => {
    const productIcons: Record<string, string> = {
      'feesttaart': '<i class="fa-solid fa-cake-candles"></i>',
      'koekjes': '<i class="fa-solid fa-cookie-bite"></i>',
      'mini-gebak': '<i class="fa-solid fa-cookie"></i>',
    };
    const icon = productIcons[item.product || ''] || '<i class="fa-solid fa-box"></i>';
    const price = item.price ? `€${Number(item.price).toFixed(2)}` : '—';
    const fields: string[] = [];
    if (item.persons)  fields.push(fieldHtml('Aantal personen', esc(item.persons)));
    if (item.flavor)   fields.push(fieldHtml('Smaak', esc(optionLabel(FLAVORS, item.flavor))));
    if (item.topper)   fields.push(fieldHtml('Taarttopper', esc(optionLabel(TOPPERS, item.topper))));
    if (item.miniType) fields.push(fieldHtml('Type', esc(optionLabel(MINI_TYPES, item.miniType))));
    if (item.quantity && item.product !== 'feesttaart') fields.push(fieldHtml('Aantal', `${esc(item.quantity)} stuks`));
    return `
    <div class="order-item-card" style="margin-bottom:${i < (order.items || []).length - 1 ? '1rem' : '0'}">
      <div class="item-card-header">
        <div class="item-card-left">
          <div class="item-index">${i + 1}</div>
          <div class="item-product-icon">${icon}</div>
          <div>
            <div class="item-label">Item ${i + 1}</div>
            <div class="item-product-name">${esc(productName(item.product || ''))}</div>
            ${item.event ? `<span class="item-event-badge"><i class="fa-solid fa-star" style="font-size:0.5rem"></i> ${esc(optionLabel(EVENTS, item.event))}</span>` : ''}
          </div>
        </div>
        <div class="item-price-tag">${price}</div>
      </div>
      <div class="item-card-body">
        ${fields.join('')}
        ${item.allergies ? `
          <div class="allergy-field">
            <i class="fa-solid fa-circle-exclamation"></i>
            <span>${esc(item.allergies)}</span>
          </div>` : ''}
        ${item.image ? photoHtml(item.image) : ''}
        ${item.message ? `
          <div class="message-field">
            <label>Bericht</label>
            <span>${esc(item.message)}</span>
          </div>` : ''}
      </div>
    </div>`;
  }).join('');

  const pickup = formatPickup(order);
  const customerHtml = `
    <div class="customer-top">
      <div class="customer-avatar">${esc(initials)}</div>
      <div>
        <div class="customer-name">${esc(fullName || '—')}</div>
        <div class="customer-contact-row">
          ${c.email ? `<div class="contact-item"><i class="fa-solid fa-envelope"></i><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div>` : ''}
          ${c.phone ? `<div class="contact-item"><i class="fa-solid fa-phone"></i><a href="tel:${esc(c.phone.replace(/[^0-9+]/g, ''))}">${esc(c.phone)}</a></div>` : ''}
        </div>
      </div>
    </div>
    <div class="info-grid">
      ${pickup ? fieldHtml('Ophalen', esc(pickup)) : ''}
      ${order.message ? `
        <div class="info-row notes-row">
          <div class="info-label">Notitie</div>
          <div class="info-value" style="white-space:pre-line">${linkPhotos(esc(order.message))}</div>
        </div>` : ''}
    </div>`;

  const totalItems = order.items?.length || 1;
  const hasMultiple = totalItems > 1;

  return `
    <!-- Status Banner -->
    <div class="status-banner" style="background:${sc.bg}; color:${sc.color}">
      <div class="status-banner-left">
        <span class="status-dot" style="background:${sc.dot}"></span>
        <span class="status-text">${sc.label}</span>
      </div>
      ${pickup ? `<span class="date-text"><i class="fa-solid fa-calendar" style="margin-right:0.25rem"></i>${esc(pickup)}</span>` : ''}
    </div>

    <!-- Customer -->
    <div class="detail-section">
      <div class="section-header">
        <span class="section-icon">
          <i class="fa-solid fa-user" style="font-size:0.75rem"></i>
        </span>
        <h4>Klant</h4>
      </div>
      <div class="customer-card">${customerHtml}</div>
    </div>

    <!-- Items -->
    <div class="detail-section">
      <div class="section-header">
        <span class="section-icon">
          <i class="fa-solid fa-boxes-stacked" style="font-size:0.75rem"></i>
        </span>
        <h4>${hasMultiple ? `Items (${totalItems})` : 'Item'}</h4>
      </div>
      <div class="order-items-list">${itemsHtml}</div>
      ${order.total ? `
        <div class="total-row">
          <span class="total-label">Totaal (indicatie)</span>
          <span class="total-amount">${esc(order.total)}</span>
        </div>` : ''}
    </div>`;
}


function fieldHtml(
  label: string,
  value: string,
  extra = '',
  isStatus = false,
  sc?: { label: string; bg: string; color: string; dot: string }
): string {
  if (isStatus && sc) {
    return `<div class="info-row ${extra}">
      <span class="info-label">${label}</span>
      <span class="status-badge-lg" style="background:${sc.bg}; color:${sc.color}">
        <span style="width:7px;height:7px;border-radius:50%;background:${sc.dot};display:inline-block"></span>
        ${sc.label}
      </span>
    </div>`;
  }
  return `<div class="info-row ${extra}">
    <span class="info-label">${label}</span>
    <span class="info-value">${value}</span>
  </div>`;
}

// ── Status Config ────────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  pending:   { label: 'In afwachting',  bg: '#fffbeb', color: '#92400e', dot: '#f59e0b' },
  approved:  { label: 'Goedgekeurd',    bg: '#eff6ff', color: '#1e40af', dot: '#3b82f6' },
  completed: { label: 'Voltooid',       bg: '#f0fdf4', color: '#166534', dot: '#22c55e' },
  cancelled: { label: 'Geannuleerd',    bg: '#fef2f2', color: '#991b1b', dot: '#ef4444' },
};

// ── Orders Page State ─────────────────────────────────────────────────────────

let orders: Order[] = [];
let currentOrderId: string | null = null;

export function getOrders() { return orders; }
export function setOrders(o: Order[]) { orders = o; }
export function getCurrentOrderId() { return currentOrderId; }
export function setCurrentOrderId(id: string | null) { currentOrderId = id; }
