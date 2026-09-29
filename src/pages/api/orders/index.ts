import type { APIRoute } from 'astro';
import { d1Query } from '../../../lib/d1';
import { tableColumns } from '../../../lib/schema';
import { listOrders } from '../../../lib/orderRepo';
import { notifyNewAanvraag, notifyStatusChange } from '../../../lib/email';
import { getDayAvailability } from '../../../lib/availability';
import {
  type AanvraagItem,
  EMAIL_RE,
  MAX_ITEMS,
  formatEuro,
  isValidPhone,
  isUploadKey,
  itemPrice,
  parseEuro,
  validateItem,
} from '../../../lib/catalog';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export const GET: APIRoute = async ({ url }) => {
  const orders = await listOrders({
    status: url.searchParams.get('status'),
    dateFrom: url.searchParams.get('dateFrom'),
    dateTo: url.searchParams.get('dateTo'),
  });
  return json(orders);
};

/** Next free id like ORD-004, based on the highest existing number (safe after deletions). */
async function nextId(table: 'orders' | 'customers', prefix: string): Promise<string> {
  const res = await d1Query(
    `SELECT MAX(CAST(SUBSTR(id, ${prefix.length + 2}) AS INTEGER)) as n FROM ${table} WHERE id LIKE ?`,
    [`${prefix}-%`]
  );
  const n = ((res.results?.[0]?.n as number) ?? 0) + 1;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: 'Ongeldige aanvraag' }, 400);
  }

  try {
    const isAdmin = body.isAdmin === true;
    const date = str(body.date, 10);
    const time = str(body.time, 5);
    const message = str(body.message, 1000);
    const rawCustomer = body.customer ?? {};

    // Admin form sends a single "name"; the public form sends first + last name.
    let firstname = str(rawCustomer.firstname, 80);
    let lastname = str(rawCustomer.lastname, 80);
    if (!firstname && !lastname && rawCustomer.name) {
      const [first, ...rest] = str(rawCustomer.name, 160).split(/\s+/);
      firstname = first ?? '';
      lastname = rest.join(' ');
    }
    const email = str(rawCustomer.email, 160).toLowerCase();
    const phone = str(rawCustomer.phone, 40);

    const items: AanvraagItem[] = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];

    // ── Validation ────────────────────────────────────────────────────────
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ success: false, error: 'Kies een geldige ophaaldatum' }, 400);

    let total: number;
    if (isAdmin) {
      if (!firstname && !email && !phone) return json({ success: false, error: 'Vul minstens naam, e-mail of telefoon in' }, 400);
      total = parseEuro(body.total);
    } else {
      if (!firstname || !lastname) return json({ success: false, error: 'Vul uw voor- en achternaam in' }, 400);
      if (!EMAIL_RE.test(email)) return json({ success: false, error: 'Vul een geldig e-mailadres in' }, 400);
      if (!isValidPhone(phone)) return json({ success: false, error: 'Vul een geldig telefoonnummer in' }, 400);
      if (!/^\d{2}:\d{2}$/.test(time)) return json({ success: false, error: 'Kies een ophaalmoment' }, 400);
      if (items.length === 0) return json({ success: false, error: 'Voeg minstens één product toe' }, 400);
      for (const item of items) {
        const problems = validateItem(item);
        if (problems.length) return json({ success: false, error: problems[0] }, 400);
      }

      const day = await getDayAvailability(date);
      if (!day || !day.available) {
        return json({ success: false, error: day?.reason ? `Deze datum is niet beschikbaar: ${day.reason}` : 'Deze datum is niet beschikbaar', code: 'date_unavailable' }, 409);
      }
      if (!day.times.includes(time)) {
        return json({ success: false, error: 'Dit ophaalmoment is niet (meer) beschikbaar. Kies een ander uur.', code: 'time_unavailable' }, 409);
      }
      // Never trust a client-side total
      total = items.reduce((sum, item) => sum + itemPrice(item), 0);
    }

    // ── Customer: find by email or create ─────────────────────────────────
    const customerCols = await tableColumns('customers');
    const hasSplitName = customerCols.has('firstname') && customerCols.has('lastname');
    const fullName = [firstname, lastname].filter(Boolean).join(' ') || email || phone;

    let customerId: string | null = null;
    if (email) {
      const existing = await d1Query('SELECT id FROM customers WHERE email = ?', [email]);
      customerId = (existing.results?.[0]?.id as string) ?? null;
    }
    if (customerId) {
      if (hasSplitName) {
        await d1Query('UPDATE customers SET name = ?, firstname = ?, lastname = ?, phone = ? WHERE id = ?',
          [fullName, firstname, lastname, phone, customerId]);
      } else {
        await d1Query('UPDATE customers SET name = ?, phone = ? WHERE id = ?', [fullName, phone, customerId]);
      }
    } else {
      customerId = await nextId('customers', 'CUST');
      // email is NOT NULL UNIQUE — admin-created orders without email get a unique placeholder
      const storedEmail = email || `geen-email+${customerId.toLowerCase()}@sweetheart.local`;
      if (hasSplitName) {
        await d1Query(
          'INSERT INTO customers (id, name, firstname, lastname, email, phone, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [customerId, fullName, firstname, lastname, storedEmail, phone, '']
        );
      } else {
        await d1Query(
          'INSERT INTO customers (id, name, email, phone, notes) VALUES (?, ?, ?, ?, ?)',
          [customerId, fullName, storedEmail, phone, '']
        );
      }
    }

    // ── Order + items ─────────────────────────────────────────────────────
    // Until migrations/0006 adds order_items.mini_type/message, keep that input in the order note
    const itemCols = await tableColumns('order_items');
    const notes = [message];
    items.forEach((item, i) => {
      const label = items.length > 1 ? `Product ${i + 1}: ` : '';
      if (!itemCols.has('mini_type') && item.miniType) notes.push(`${label}type ${str(item.miniType, 40)}`);
      if (!itemCols.has('message') && str(item.message)) notes.push(`${label}${str(item.message, 1000)}`);
      if (!itemCols.has('image') && item.image) notes.push(`${label}voorbeeldfoto: /admin/api/upload?key=${item.image}`);
    });
    const orderMessage = notes.filter(Boolean).join('\n');

    const orderId = await nextId('orders', 'ORD');
    await d1Query(
      'INSERT INTO orders (id, customer_id, date, time, status, total, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [orderId, customerId, date, time || null, 'pending', total, orderMessage]
    );

    for (const [i, item] of items.entries()) {
      const cols = ['id', 'order_id', 'product', 'event', 'persons', 'flavor', 'topper', 'allergies', 'price', 'quantity'];
      const values: any[] = [
        `${orderId}-ITEM-${i + 1}`,
        orderId,
        str(item.product, 40),
        str(item.event, 60) || null,
        str(item.persons, 20) || null,
        str(item.flavor, 80) || null,
        str(item.topper, 40) || null,
        str(item.allergies, 500) || null,
        isAdmin ? parseEuro((item as any).price) : itemPrice(item),
        item.product === 'feesttaart' ? 1 : Number(item.quantity) || 1,
      ];
      if (itemCols.has('mini_type')) { cols.push('mini_type'); values.push(str(item.miniType, 40) || null); }
      if (itemCols.has('message')) { cols.push('message'); values.push(str(item.message, 1000) || null); }
      if (itemCols.has('image')) { cols.push('image'); values.push(item.image && isUploadKey(item.image) ? item.image : null); }
      await d1Query(
        `INSERT INTO order_items (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
        values
      );
    }

    // Fire-and-forget: the customer shouldn't wait on (or be blocked by) the mail provider
    if (!isAdmin) void notifyNewAanvraag(orderId).catch((err) => console.error('[api/orders] notify failed:', err));

    return json({ success: true, orderId, total: formatEuro(total) }, 201);
  } catch (error: any) {
    console.error('[api/orders] POST failed:', error);
    return json({ success: false, error: 'Er ging iets mis bij het opslaan. Probeer het opnieuw of bel ons even.' }, 500);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { orderId, status, notify = true } = body;

    if (!orderId || !status) {
      return json({ success: false, error: 'orderId and status are required' }, 400);
    }

    const validStatuses = ['pending', 'approved', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return json({ success: false, error: 'Invalid status' }, 400);
    }

    const current = await d1Query('SELECT status FROM orders WHERE id = ?', [orderId]);
    const previous = current.results?.[0]?.status as string | undefined;
    if (!previous) return json({ success: false, error: 'Aanvraag niet gevonden' }, 404);

    await d1Query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);

    // Only e-mail the customer on a real change (not when re-saving the same status)
    const emailed = notify !== false && previous !== status ? await notifyStatusChange(orderId, status) : false;

    return json({ success: true, emailed });
  } catch (error: any) {
    return json({ success: false, error: error?.message }, 500);
  }
};
