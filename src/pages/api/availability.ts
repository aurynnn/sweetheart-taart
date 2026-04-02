import type { APIRoute } from 'astro';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const ORDERS_FILE = join(DATA_DIR, 'orders.json');
const SETTINGS_FILE = join(DATA_DIR, 'settings.json');

interface Order {
  id: string;
  date: string;
  status: string;
}

interface Settings {
  maxOrdersPerDay: number;
  googleConnected: boolean;
  blockedDates: Array<{ date: string; reason: string }>;
  recurringUnavailableDays: number[]; // 0 = Sunday, 1 = Monday, etc.
  availableDays: number[]; // Which days of week are available (default all except Sunday)
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    import('fs').then(fs => fs.mkdirSync(DATA_DIR, { recursive: true }));
  }
}

function getOrders(): Order[] {
  ensureDataDir();
  if (!existsSync(ORDERS_FILE)) {
    return [];
  }
  try {
    const data = readFileSync(ORDERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function getSettings(): Settings {
  ensureDataDir();
  if (!existsSync(SETTINGS_FILE)) {
    // Default settings - open Mon-Sat, closed Sunday
    return {
      maxOrdersPerDay: 3,
      googleConnected: false,
      blockedDates: [],
      recurringUnavailableDays: [0], // Sunday = 0
      availableDays: [1, 2, 3, 4, 5, 6] // Mon-Sat
    };
  }
  try {
    const data = readFileSync(SETTINGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      maxOrdersPerDay: 3,
      googleConnected: false,
      blockedDates: [],
      recurringUnavailableDays: [0],
      availableDays: [1, 2, 3, 4, 5, 6]
    };
  }
}

export const GET: APIRoute = async ({ url }) => {
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  
  const orders = getOrders();
  const settings = getSettings();
  
  // Count orders per date
  const ordersByDate: Record<string, number> = {};
  orders.forEach(order => {
    if (order.status !== 'cancelled') {
      ordersByDate[order.date] = (ordersByDate[order.date] || 0) + 1;
    }
  });
  
  // Generate availability for date range
  const availability: Array<{
    date: string;
    available: boolean;
    orders: number;
    maxOrders: number;
    remaining: number;
    reason?: string;
  }> = [];
  
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);
    
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay();
      const ordersCount = ordersByDate[dateStr] || 0;
      const isBlocked = settings.blockedDates.some(b => b.date === dateStr);
      const isPast = current < new Date(new Date().toDateString());
      const isRecurringUnavailable = settings.recurringUnavailableDays.includes(dayOfWeek);
      const isAvailableDay = settings.availableDays.includes(dayOfWeek);
      
      let reason: string | undefined;
      let isAvailable = true;
      
      if (isPast) {
        isAvailable = false;
        reason = 'Datum is voorbij';
      } else if (isBlocked) {
        isAvailable = false;
        const blockedEntry = settings.blockedDates.find(b => b.date === dateStr);
        reason = blockedEntry?.reason || 'Geblokkeerd';
      } else if (isRecurringUnavailable || !isAvailableDay) {
        isAvailable = false;
        const dayNames = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
        reason = `Elke ${dayNames[dayOfWeek]} gesloten`;
      } else if (ordersCount >= settings.maxOrdersPerDay) {
        isAvailable = false;
        reason = 'Volledig bezet';
      }
      
      availability.push({
        date: dateStr,
        available: isAvailable,
        orders: ordersCount,
        maxOrders: settings.maxOrdersPerDay,
        remaining: Math.max(0, settings.maxOrdersPerDay - ordersCount),
        reason
      });
      
      current.setDate(current.getDate() + 1);
    }
  }
  
  return new Response(JSON.stringify({
    settings,
    availability
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { maxOrdersPerDay, blockedDates } = await request.json();
    
    ensureDataDir();
    const settings: Settings = {
      maxOrdersPerDay: maxOrdersPerDay || 3,
      googleConnected: false, // Will be updated by Google OAuth flow
      blockedDates: blockedDates || []
    };
    
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    
    return new Response(JSON.stringify({ success: true, settings }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Failed to save settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
