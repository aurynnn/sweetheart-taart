// src/lib/orderRepo.ts — Reading orders (with customer + items) from D1.
// Shared by GET /api/orders, the status-change e-mails and anything else that needs full orders.

import { d1Query } from './d1';
import { tableColumns, customerNameSql } from './schema';
import { formatEuro, parseEuro } from './catalog';
import { attachNotePhotos } from './orders';

export interface OrderFilters {
  id?: string;
  ids?: string[];
  status?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface FullOrder {
  id: string;
  date: string;
  time: string | null;
  status: string;
  total: string;
  totalValue: number;
  message: string | null;
  createdAt: string;
  customer: { id: string; firstname: string; lastname: string; email: string; phone: string; notes: string | null };
  items: Array<{
    id: string; product: string; event?: string; persons?: string; flavor?: string; topper?: string;
    allergies?: string; price: number; quantity?: number; miniType?: string; message?: string; image?: string;
  }>;
}

export async function listOrders(filters: OrderFilters = {}): Promise<FullOrder[]> {
  const name = await customerNameSql('c');
  let query = `
    SELECT
      o.id, o.date, o.time, o.status, o.total, o.message, o.created_at,
      c.id as customer_id, ${name.first} as firstname, ${name.last} as lastname,
      c.email, c.phone, c.notes
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE 1=1
  `;
  const bindings: unknown[] = [];
  if (filters.id) { query += ' AND o.id = ?'; bindings.push(filters.id); }
  if (filters.ids?.length) { query += ` AND o.id IN (${filters.ids.map(() => '?').join(',')})`; bindings.push(...filters.ids); }
  if (filters.status) { query += ' AND o.status = ?'; bindings.push(filters.status); }
  if (filters.dateFrom) { query += ' AND o.date >= ?'; bindings.push(filters.dateFrom); }
  if (filters.dateTo) { query += ' AND o.date <= ?'; bindings.push(filters.dateTo); }
  query += ' ORDER BY o.created_at DESC';

  const rows = (await d1Query(query, bindings)).results || [];

  // One query for all items instead of one per order
  const itemsByOrder = new Map<string, FullOrder['items']>();
  if (rows.length) {
    const itemCols = await tableColumns('order_items');
    const itemsResult = await d1Query(
      `SELECT * FROM order_items WHERE order_id IN (${rows.map(() => '?').join(',')}) ORDER BY id`,
      rows.map((r: any) => r.id)
    );
    for (const item of itemsResult.results || []) {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push({
        id: item.id,
        product: item.product,
        event: item.event,
        persons: item.persons,
        flavor: item.flavor,
        topper: item.topper,
        allergies: item.allergies,
        price: item.price,
        quantity: item.product === 'feesttaart' ? undefined : item.quantity,
        miniType: itemCols.has('mini_type') ? item.mini_type : undefined,
        message: itemCols.has('message') ? item.message : undefined,
        image: itemCols.has('image') ? item.image : undefined,
      });
      itemsByOrder.set(item.order_id, list);
    }
  }

  return rows.map((row: any) => attachNotePhotos({
    id: row.id,
    date: row.date,
    time: row.time,
    status: row.status,
    total: formatEuro(parseEuro(row.total)),
    totalValue: parseEuro(row.total),
    message: row.message,
    createdAt: row.created_at,
    customer: {
      id: row.customer_id,
      firstname: row.firstname,
      lastname: row.lastname,
      email: row.email,
      phone: row.phone,
      notes: row.notes,
    },
    items: itemsByOrder.get(row.id) ?? [],
  } as any) as FullOrder);
}

export async function getOrder(id: string): Promise<FullOrder | null> {
  const [order] = await listOrders({ id });
  return order ?? null;
}
