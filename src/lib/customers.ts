// src/lib/customers.ts — Customers (one per e-mail address, enforced by the UNIQUE
// constraint on customers.email) with their orders, reminders and ratings.
// Includes the GDPR tools: data export (right of access) and erasure.

import { d1Query } from './d1';
import { tableColumns, customerNameSql } from './schema';
import { parseEuro, isUploadKey } from './catalog';
import { listOrders, type FullOrder } from './orderRepo';
import { ensureReminderTables, listReminders, listOptouts, type Reminder } from './reminders';
import { ensureReviewTable } from './reviews';
import { deleteObject } from './r2';

export interface CustomerSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  orders: number;
  spent: number;
  lastOrder: string | null;
  nextPickup: string | null;
  reminders: number;
  rating: number | null;
  optedOut: boolean;
  anonymized: boolean;
}

export const isAnonymized = (email: string) => /@sweetheart\.local$/.test(email) && email.startsWith('verwijderd+');

export async function listCustomers(): Promise<CustomerSummary[]> {
  await Promise.all([ensureReminderTables(), ensureReviewTable()]);
  const name = await customerNameSql('c');
  const [customers, orders, reminders, ratings, optouts] = await Promise.all([
    d1Query(`SELECT c.id, ${name.full} as name, c.email, c.phone, c.created_at FROM customers c`),
    d1Query(`SELECT customer_id, date, status, total FROM orders`),
    d1Query(`SELECT email, COUNT(*) as n FROM reminders WHERE status IN ('pending','active') GROUP BY email`),
    d1Query(`SELECT o.customer_id, AVG(r.rating) as avg FROM review_requests r JOIN orders o ON o.id = r.order_id WHERE r.rating IS NOT NULL GROUP BY o.customer_id`),
    listOptouts(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const remindersByEmail = new Map((reminders.results || []).map((r: any) => [String(r.email), Number(r.n)]));
  const ratingByCustomer = new Map((ratings.results || []).map((r: any) => [String(r.customer_id), Number(r.avg)]));

  return (customers.results || []).map((c: any) => {
    const own = (orders.results || []).filter((o: any) => o.customer_id === c.id);
    const active = own.filter((o: any) => o.status !== 'cancelled');
    const dates = active.map((o: any) => String(o.date)).sort();
    const email = String(c.email || '');
    return {
      id: c.id,
      name: String(c.name || '').trim() || email,
      email,
      phone: c.phone || '',
      createdAt: c.created_at,
      orders: own.length,
      spent: active.reduce((s: number, o: any) => s + parseEuro(o.total), 0),
      lastOrder: dates.filter((d) => d <= today).pop() ?? null,
      nextPickup: dates.find((d) => d >= today) ?? null,
      reminders: remindersByEmail.get(email.toLowerCase()) ?? 0,
      rating: ratingByCustomer.get(c.id) ?? null,
      optedOut: optouts.has(email.toLowerCase()),
      anonymized: isAnonymized(email),
    };
  }).sort((a, b) => (b.lastOrder ?? b.nextPickup ?? '').localeCompare(a.lastOrder ?? a.nextPickup ?? ''));
}

export interface CustomerDetail {
  customer: { id: string; firstname: string; lastname: string; email: string; phone: string; createdAt: string };
  orders: FullOrder[];
  reminders: Reminder[];
  reviews: Array<{ order_id: string; rating: number | null; liked: string | null; feedback: string | null; rated_at: string | null }>;
  optedOut: boolean;
}

export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  const name = await customerNameSql('c');
  const res = await d1Query(`SELECT c.id, ${name.first} as firstname, ${name.last} as lastname, c.email, c.phone, c.created_at FROM customers c WHERE c.id = ?`, [id]);
  const c: any = res.results?.[0];
  if (!c) return null;
  await ensureReviewTable();
  const [orders, reminders, reviews, optouts] = await Promise.all([
    listOrders({ customerId: id }),
    listReminders({ email: c.email }),
    d1Query(`SELECT r.order_id, r.rating, r.liked, r.feedback, r.rated_at FROM review_requests r JOIN orders o ON o.id = r.order_id WHERE o.customer_id = ?`, [id]),
    listOptouts(),
  ]);
  return {
    customer: { id: c.id, firstname: c.firstname ?? '', lastname: c.lastname ?? '', email: c.email, phone: c.phone ?? '', createdAt: c.created_at },
    orders,
    reminders,
    reviews: (reviews.results || []) as CustomerDetail['reviews'],
    optedOut: optouts.has(String(c.email).toLowerCase()),
  };
}

export async function getCustomerByEmail(email: string): Promise<{ id: string; email: string; firstname: string } | null> {
  const name = await customerNameSql('c');
  const res = await d1Query(`SELECT c.id, c.email, ${name.first} as firstname FROM customers c WHERE c.email = ?`, [email.toLowerCase()]);
  return (res.results?.[0] as any) ?? null;
}

export async function getCustomerById(id: string): Promise<{ id: string; email: string; firstname: string } | null> {
  const name = await customerNameSql('c');
  const res = await d1Query(`SELECT c.id, c.email, ${name.first} as firstname FROM customers c WHERE c.id = ?`, [id]);
  return (res.results?.[0] as any) ?? null;
}

/** GDPR right of access: everything we store about this customer, as plain JSON */
export async function exportCustomer(id: string) {
  const detail = await getCustomerDetail(id);
  if (!detail) return null;
  return {
    exportedAt: new Date().toISOString(),
    controller: 'Sweetheart — Koekjes, Cake & Taart',
    customer: detail.customer,
    orders: detail.orders.map((o) => ({ id: o.id, date: o.date, time: o.time, status: o.status, total: o.total, message: o.message, createdAt: o.createdAt, items: o.items })),
    reminders: detail.reminders.map(({ id: _id, ...r }) => r),
    reviews: detail.reviews,
    marketingOptOut: detail.optedOut,
  };
}

/**
 * GDPR right to erasure. Personal data is removed or anonymised; the order rows
 * themselves (date, products, amount) stay, without any link to the person, because
 * they may be needed for the bookkeeping. Example photos are deleted from storage.
 */
export async function eraseCustomer(id: string): Promise<boolean> {
  const detail = await getCustomerDetail(id);
  if (!detail) return false;
  const email = detail.customer.email.toLowerCase();
  const orderIds = detail.orders.map((o) => o.id);

  // 1. Delete uploaded example photos
  const photos = detail.orders.flatMap((o) => o.items.map((i) => i.image)).filter((k): k is string => !!k && isUploadKey(k));
  await Promise.all(photos.map((k) => deleteObject(k).catch((e) => console.warn('[erase] photo delete failed', k, e))));

  // 2. Anonymise the customer record (row kept so orders stay consistent)
  const custCols = await tableColumns('customers');
  const placeholder = `verwijderd+${id.toLowerCase()}@sweetheart.local`;
  const sets = ['name = ?', 'email = ?', 'phone = NULL', 'notes = NULL'];
  const values: unknown[] = ['Verwijderde klant', placeholder];
  if (custCols.has('firstname')) sets.push("firstname = 'Verwijderde'");
  if (custCols.has('lastname')) sets.push("lastname = 'klant'");
  await d1Query(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);

  // 3. Remove free text (can contain personal info) from orders and items
  if (orderIds.length) {
    const inList = orderIds.map(() => '?').join(',');
    await d1Query(`UPDATE orders SET message = NULL WHERE id IN (${inList})`, orderIds);
    const itemCols = await tableColumns('order_items');
    const itemSets = ['allergies = NULL'];
    if (itemCols.has('message')) itemSets.push('message = NULL');
    if (itemCols.has('image')) itemSets.push('image = NULL');
    await d1Query(`UPDATE order_items SET ${itemSets.join(', ')} WHERE order_id IN (${inList})`, orderIds);
    await d1Query(`UPDATE review_requests SET feedback = NULL, liked = NULL WHERE order_id IN (${inList})`, orderIds);
  }

  // 4. Reminders and opt-out entry contain the e-mail address → delete
  await ensureReminderTables();
  await d1Query('DELETE FROM reminders WHERE email = ?', [email]);
  await d1Query('DELETE FROM email_optouts WHERE email = ?', [email]);
  return true;
}
