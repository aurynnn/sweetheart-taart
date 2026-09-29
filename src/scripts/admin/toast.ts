// src/scripts/admin/toast.ts — Small toast notifications for the admin panel
// (uses the #toast-container rendered by AdminLayout).

export function toast(message: string, kind: 'ok' | 'error' = 'ok') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  if (kind === 'error') el.style.background = '#ef4444';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.2s ease forwards';
    setTimeout(() => el.remove(), 200);
  }, 3200);
}

export const STATUS_DONE: Record<string, string> = {
  approved: 'goedgekeurd',
  completed: 'voltooid',
  cancelled: 'geweigerd',
  pending: 'terug op in afwachting',
};

/** PATCH a status and toast the result. Returns true on success. */
export async function updateStatus(orderId: string, status: string, { silent = false } = {}): Promise<boolean> {
  try {
    const res = await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const { emailed } = await res.json();
    if (!silent) toast(`Aanvraag ${orderId} ${STATUS_DONE[status] ?? status}${emailed ? ' · klant is gemaild' : ''}`);
    return true;
  } catch {
    if (!silent) toast(`Bijwerken van ${orderId} mislukt. Probeer opnieuw.`, 'error');
    return false;
  }
}
