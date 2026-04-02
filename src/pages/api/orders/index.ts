import type { APIRoute } from 'astro';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_FILE = join(process.cwd(), 'data', 'orders.json');

interface Order {
  id: string;
  date: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  items: Array<{
    product: string;
    event?: string;
    persons?: string;
    flavor?: string;
    allergies?: string;
    message?: string;
    quantity?: string;
  }>;
  total: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
}

function ensureDataDir() {
  const dir = join(process.cwd(), 'data');
  if (!existsSync(dir)) {
    import('fs').then(fs => fs.mkdirSync(dir, { recursive: true }));
  }
}

function getOrders(): Order[] {
  ensureDataDir();
  if (!existsSync(DATA_FILE)) {
    return [];
  }
  try {
    const data = readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveOrders(orders: Order[]) {
  ensureDataDir();
  writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2));
}

export const GET: APIRoute = async () => {
  const orders = getOrders();
  return new Response(JSON.stringify(orders), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const order = await request.json();
    
    // Generate order ID
    const orders = getOrders();
    const orderId = `ORD-${String(orders.length + 1).padStart(3, '0')}`;
    
    // Create order object
    const newOrder: Order = {
      id: orderId,
      date: order.date,
      customer: order.customer,
      items: order.items,
      total: order.total,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    orders.push(newOrder);
    saveOrders(orders);
    
    return new Response(JSON.stringify({ success: true, order: newOrder }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Failed to save order' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
