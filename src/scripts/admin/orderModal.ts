// src/scripts/admin/orderModal.ts — Shared behaviour of the order detail pop-up
// (markup: components/admin/orders/OrderModal.astro). Used by the dashboard and Todo page.

import { STATUS_CONFIG, renderOrderDetail, esc, type Order } from '../../lib/orders';
import { updateStatus } from './toast';

interface Options {
  /** Called after the status was changed from inside the modal */
  onStatusChanged?: (orderId: string, status: string) => void;
}

let current: Order | null = null;

const $ = (id: string) => document.getElementById(id);

export function openOrderModal(order: Order) {
  current = order;
  const d = order.date ? new Date(order.date + 'T00:00:00') : null;
  const subtitle = $('modalOrderId');
  if (subtitle) {
    subtitle.textContent = d && !isNaN(d.getTime())
      ? `#${order.id} · Ophalen ${d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })}${order.time ? ` om ${order.time}` : ''}`
      : `#${order.id}`;
  }
  const badge = $('modalStatusBadge');
  if (badge) {
    const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
    badge.innerHTML = `<span class="dot" style="background:${sc.dot}"></span>${esc(sc.label)}`;
    badge.style.background = sc.bg;
    badge.style.color = sc.color;
  }
  const body = $('orderModalBody');
  if (body) {
    body.innerHTML = renderOrderDetail(order);
    body.scrollTop = 0;
  }
  const select = $('orderStatusAction') as HTMLSelectElement | null;
  if (select) select.value = '';
  $('orderModal')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

export function closeOrderModal() {
  $('orderModal')?.classList.remove('active');
  document.body.style.overflow = '';
  current = null;
}

export function initOrderModal({ onStatusChanged }: Options = {}) {
  $('closeOrderModalBtn')?.addEventListener('click', closeOrderModal);
  $('closeOrderModalBtn2')?.addEventListener('click', closeOrderModal);
  $('orderModal')?.addEventListener('click', (e) => {
    if ((e.target as Element).classList.contains('modal-overlay')) closeOrderModal();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOrderModal(); });
  $('updateStatusBtn')?.addEventListener('click', async () => {
    const status = ($('orderStatusAction') as HTMLSelectElement | null)?.value;
    if (!status || !current) return;
    const id = current.id;
    if (await updateStatus(id, status)) {
      closeOrderModal();
      onStatusChanged?.(id, status);
    }
  });
}
