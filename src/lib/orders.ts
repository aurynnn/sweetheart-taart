// src/lib/orders.ts — Shared order rendering helpers for the admin panel

export interface OrderItem {
  product?: string;
  event?: string;
  miniType?: string;
  quantity?: number;
  persons?: number;
  flavor?: string;
  allergies?: string;
  message?: string;
  price?: number;
}

export interface OrderCustomer {
  name?: string;
  email?: string;
  phone?: string;
}

export interface Order {
  id: string;
  date?: string;
  status: string;
  customer?: OrderCustomer;
  items?: OrderItem[];
  total?: string;
  message?: string;
  pickup_date?: string;
  order_type?: string;
}

// ── Render ───────────────────────────────────────────────────────────────────

export function renderOrderDetail(order: Order): string {
  const c = order.customer || {};
  const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;

  // Customer avatar initials
  const initials = (c.name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  const itemsHtml = (order.items || []).map((item, i) => {
    const productIcons: Record<string, string> = {
      'feesttaart': '<i class="fa-solid fa-cake-candles"></i>',
      'koekjes': '<i class="fa-solid fa-cookie-bite"></i>',
      'mini-gebak': '<i class="fa-solid fa-cookie"></i>',
    };
    const icon = productIcons[item.product || ''] || '<i class="fa-solid fa-box"></i>';
    const price = item.price ? `€${item.price.toFixed(2)}` : (order.total || '—');
    const fields: string[] = [];
    if (item.persons)  fields.push(fieldHtml('Aantal personen', String(item.persons)));
    if (item.flavor)   fields.push(fieldHtml('Smaak', item.flavor));
    if (item.miniType) fields.push(fieldHtml('Type', item.miniType === 'mini-cupcakes' ? 'Mini cupcakes' : 'Cupcakes'));
    if (item.quantity) fields.push(fieldHtml('Aantal', `${item.quantity} stuks`));
    return `
    <div class="order-item-card" style="margin-bottom:${i < (order.items || []).length - 1 ? '1rem' : '0'}">
      <div class="item-card-header">
        <div class="item-card-left">
          <div class="item-index">${i + 1}</div>
          <div class="item-product-icon">${icon}</div>
          <div>
            <div class="item-label">Item ${i + 1}</div>
            <div class="item-product-name">${productLabel(item.product || '')}</div>
            ${item.event ? `<span class="item-event-badge"><i class="fa-solid fa-star" style="font-size:0.5rem"></i> ${item.event}</span>` : ''}
          </div>
        </div>
        <div class="item-price-tag">${price}</div>
      </div>
      <div class="item-card-body">
        ${fields.join('')}
        ${item.allergies ? `
          <div class="allergy-field">
            <i class="fa-solid fa-circle-exclamation"></i>
            <span>${item.allergies}</span>
          </div>` : ''}
        ${item.message ? `
          <div class="message-field">
            <label>Bericht</label>
            <span>${item.message}</span>
          </div>` : ''}
      </div>
    </div>`;
  }).join('');

  const customerHtml = `
    <div class="customer-top">
      <div class="customer-avatar">${initials}</div>
      <div>
        <div class="customer-name">${c.name || '—'}</div>
        <div class="customer-contact-row">
          ${c.email ? `<div class="contact-item"><i class="fa-solid fa-envelope"></i><a href="mailto:${c.email}">${c.email}</a></div>` : ''}
          ${c.phone ? `<div class="contact-item"><i class="fa-solid fa-phone"></i><a href="tel:${c.phone}">${c.phone}</a></div>` : ''}
        </div>
      </div>
    </div>
    <div class="info-grid">
      ${order.pickup_date ? fieldHtml('Ophaaldatum', order.pickup_date) : ''}
      ${order.order_type  ? fieldHtml('Type', order.order_type) : ''}
      ${order.message ? `
        <div class="info-row notes-row">
          <div class="info-label">Notitie</div>
          <div class="info-value">${order.message}</div>
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
      ${order.pickup_date ? `<span class="date-text"><i class="fa-solid fa-calendar" style="margin-right:0.25rem"></i>${order.pickup_date}</span>` : ''}
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
          <span class="total-label">Totaal</span>
          <span class="total-amount">${order.total}</span>
        </div>` : ''}
    </div>`;
}

function productLabel(product: string): string {
  const labels: Record<string, string> = {
    'feesttaart': 'Feesttaart', 'koekjes': 'Koekjes', 'mini-gebak': 'Mini-gebak'
  };
  return labels[product] || product;
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
