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

  const itemsHtml = (order.items || []).map(item => `
    <div class="order-item-card">
      <div class="item-card-header">
        <span class="item-product-name">${item.product || '—'}</span>
        ${item.event ? `<span class="event-badge">${item.event}</span>` : ''}
      </div>
      <div class="item-card-body">
        ${fieldHtml('Aantal personen', item.persons ? `${item.persons}` : '—')}
        ${fieldHtml('Smaak', item.flavor || '—')}
        ${fieldHtml('Type', item.miniType || '—')}
        ${item.quantity ? fieldHtml('Aantal', `${item.quantity}x`) : ''}
        ${fieldHtml('Prijs', item.price ? `€${item.price.toFixed(2)}` : '—')}
        ${item.message ? `
          <div class="item-field" style="grid-column:1/-1">
            <label>Bericht</label>
            <span>${item.message}</span>
          </div>` : ''}
        ${item.allergies ? `
          <div class="allergy-field" style="grid-column:1/-1">
            <label style="display:block;font-size:0.625rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin-bottom:0.25rem">Allergieën</label>
            <span>⚠️ ${item.allergies}</span>
          </div>` : ''}
      </div>
    </div>`).join('');

  const customerHtml = `
    <div class="info-grid">
      ${fieldHtml('Naam', c.name || '—', 'full-width')}
      ${c.email ? fieldHtml('E-mail', c.email) : ''}
      ${c.phone ? fieldHtml('Telefoon', c.phone) : ''}
      ${fieldHtml('Status', '', 'full-width', true, sc)}
      ${order.pickup_date ? fieldHtml('Ophaaldatum', order.pickup_date) : ''}
      ${order.order_type ? fieldHtml('Type', order.order_type) : ''}
      ${order.message ? `
        <div class="info-row notes-row">
          <span class="info-label">Notities</span>
          <span class="info-value">${order.message}</span>
        </div>` : ''}
    </div>`;

  const footerHtml = order.items && order.items.length > 1 ? `
    <div class="detail-section">
      <div class="section-header">
        <span class="section-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
          </svg>
        </span>
        <h4>Alle Items (${order.items.length})</h4>
      </div>
      <div class="order-items-list">${itemsHtml}</div>
      <div class="total-row">
        <span class="total-label">Totaal</span>
        <span class="total-amount">${order.total || '€0,00'}</span>
      </div>
    </div>` : `
    <div class="detail-section">
      <div class="section-header">
        <span class="section-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
          </svg>
        </span>
        <h4>Item</h4>
      </div>
      <div class="order-items-list">${itemsHtml}</div>
      ${order.total ? `
        <div class="total-row">
          <span class="total-label">Totaal</span>
          <span class="total-amount">${order.total}</span>
        </div>` : ''}
    </div>`;

  return `
    <div class="detail-section">
      <div class="section-header">
        <span class="section-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </span>
        <h4>Klant</h4>
      </div>
      ${customerHtml}
    </div>
    ${footerHtml}`;
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
