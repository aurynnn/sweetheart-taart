// src/lib/retention.ts — GDPR storage limitation: data is not kept longer than needed.
// The periods are shown on /privacy, so the text and the behaviour never drift apart.

import { d1Query } from './d1';
import { tableColumns } from './schema';
import { isUploadKey } from './catalog';
import { listOrders } from './orderRepo';
import { deleteObject } from './r2';
import { toLocalDateStr } from './availability';

export const PHOTO_RETENTION_MONTHS = 12;
export const CUSTOMER_RETENTION_YEARS = 3;

/** Deletes customers' example photos PHOTO_RETENTION_MONTHS after the pickup date. */
export async function purgeOldPhotos(): Promise<number> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - PHOTO_RETENTION_MONTHS);
  const orders = await listOrders({ dateTo: toLocalDateStr(cutoff) });
  const itemCols = await tableColumns('order_items');
  let removed = 0;

  for (const order of orders) {
    const photos = order.items.filter((i) => i.image && isUploadKey(i.image));
    if (!photos.length) continue;
    for (const item of photos) {
      await deleteObject(item.image!).catch((e) => console.warn('[retention] delete failed', item.image, e));
      if (itemCols.has('image')) await d1Query('UPDATE order_items SET image = NULL WHERE id = ?', [item.id]);
      removed++;
    }
    // Before migrations/0006 the photo reference lives in the note; listOrders() already
    // moved it onto the item, so order.message is the note without the photo lines.
    await d1Query('UPDATE orders SET message = ? WHERE id = ?', [order.message || null, order.id]);
  }
  return removed;
}

/**
 * Anonymises customers whose last aanvraag is more than CUSTOMER_RETENTION_YEARS ago
 * and who have no active reminder (a reminder means they asked us to keep in touch).
 */
export async function purgeInactiveCustomers(): Promise<number> {
  const { listCustomers, eraseCustomer } = await import('./customers');
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - CUSTOMER_RETENTION_YEARS);
  const cutoffIso = toLocalDateStr(cutoff);
  const stale = (await listCustomers()).filter((c) =>
    !c.anonymized && c.reminders === 0 && !c.nextPickup && (c.lastOrder ?? c.createdAt?.slice(0, 10) ?? '9999') < cutoffIso);
  for (const c of stale) await eraseCustomer(c.id);
  return stale.length;
}
