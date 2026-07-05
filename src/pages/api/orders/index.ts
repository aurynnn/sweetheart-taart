import type { APIRoute } from 'astro';
import { d1Query, d1Exec } from '../../../lib/d1';

export const GET: APIRoute = async ({ url }) => {
  const status = url.searchParams.get('status');
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');

  let query = `
    SELECT
      o.id, o.date, o.status, o.total, o.message, o.created_at,
      c.id as customer_id, c.name, c.email, c.phone, c.notes
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE 1=1
  `;
  const bindings: any[] = [];

  if (status) {
    query += ' AND o.status = ?';
    bindings.push(status);
  }
  if (dateFrom) {
    query += ' AND o.date >= ?';
    bindings.push(dateFrom);
  }
  if (dateTo) {
    query += ' AND o.date <= ?';
    bindings.push(dateTo);
  }

  query += ' ORDER BY o.created_at DESC';

  const ordersResult = await d1Query(query, bindings);
  const orders: any[] = [];

  for (const row of ordersResult.results || []) {
    const orderId = row.id as string;

    const itemsResult = await d1Query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [orderId]
    );

    orders.push({
      id: row.id,
      date: row.date,
      status: row.status,
      total: row.total,
      message: row.message,
      createdAt: row.created_at,
      customer: {
        id: row.customer_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        notes: row.notes,
      },
      items: itemsResult.results?.map((item: any) => ({
        id: item.id,
        product: item.product,
        event: item.event,
        persons: item.persons,
        flavor: item.flavor,
        allergies: item.allergies,
        price: item.price,
        quantity: item.quantity,
        miniType: item.mini_type,
      })) || [],
    });
  }

  return new Response(JSON.stringify(orders), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { date, customer, items, total, message, isAdmin } = body;

    // Check availability (skip for admin-created orders)
    if (!isAdmin) {
      const dayOfWeek = new Date(date + 'T00:00:00').getDay();
      const recRow = await d1Query(
        'SELECT enabled, max_orders FROM recurring_schedule WHERE day_of_week = ?',
        [dayOfWeek]
      );
      const maxOrders = recRow.results?.[0]?.max_orders as number ?? 3;

      const countResult = await d1Query(
        "SELECT COUNT(*) as cnt FROM orders WHERE date = ? AND status != 'cancelled'",
        [date]
      );
      const currentCount = countResult.results?.[0]?.cnt as number ?? 0;

      if (currentCount >= maxOrders) {
        return new Response(
          JSON.stringify({ success: false, error: 'Date is fully booked' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Find or create customer
    let customerId: string | null = null;
    if (customer && (customer.name || customer.email || customer.phone)) {
      if (customer.email) {
        const existingCustomer = await d1Query(
          'SELECT id FROM customers WHERE email = ?',
          [customer.email]
        );
        if (existingCustomer.results && existingCustomer.results.length > 0) {
          customerId = existingCustomer.results[0].id as string;
          await d1Query(
            'UPDATE customers SET name = ?, phone = ? WHERE id = ?',
            [customer.name ?? null, customer.phone ?? null, customerId]
          );
        }
      }
      if (!customerId) {
        const custCount = await d1Query('SELECT COUNT(*) as cnt FROM customers');
        const custNum = ((custCount.results?.[0]?.cnt as number) ?? 0) + 1;
        customerId = `CUST-${String(custNum).padStart(3, '0')}`;
        await d1Query(
          'INSERT INTO customers (id, name, email, phone, notes) VALUES (?, ?, ?, ?, ?)',
          [customerId, customer.name ?? '', customer.email ?? '', customer.phone ?? '', customer.notes ?? '']
        );
      }
    }

    // Get next order number
    const countAll = await d1Query('SELECT COUNT(*) as cnt FROM orders');
    const orderNum = ((countAll.results?.[0]?.cnt as number) ?? 0) + 1;
    const orderId = `ORD-${String(orderNum).padStart(3, '0')}`;
    const orderDate = date ?? new Date().toISOString().split('T')[0];

    // Insert order
    await d1Query(
      'INSERT INTO orders (id, customer_id, date, status, total, message) VALUES (?, ?, ?, ?, ?, ?)',
      [orderId, customerId, orderDate, 'pending', total ?? '', message ?? '']
    );

    // Insert order items
    for (const item of items || []) {
      const itemCount = await d1Query('SELECT COUNT(*) as cnt FROM order_items');
      const itemNum = ((itemCount.results?.[0]?.cnt as number) ?? 0) + 1;
      const itemId = `${orderId}-ITEM-${itemNum}`;

      await d1Query(
        `INSERT INTO order_items (id, order_id, product, event, persons, flavor, allergies, price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          orderId,
          item.product,
          item.event ?? null,
          item.persons ?? null,
          item.flavor ?? null,
          item.allergies ?? null,
          item.price ?? 0,
        ]
      );
    }

    return new Response(
      JSON.stringify({ success: true, orderId }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? 'Failed to save order' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return new Response(
        JSON.stringify({ success: false, error: 'orderId and status are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const validStatuses = ['pending', 'approved', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid status' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await d1Query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
