/**
 * Google Calendar Integration Module
 * Reusable module for connecting to Google Calendar API
 * 
 * Usage:
 * 1. Set up OAuth2 credentials in Google Cloud Console
 * 2. Add credentials to environment variables
 * 3. Use the methods below to manage availability
 */

const GOOGLE_CLIENT_ID = import.meta.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = import.meta.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = import.meta.env.GOOGLE_REDIRECT_URI || 'http://localhost:4321/admin/api/calendar/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events'
].join(' ');

/**
 * Generate the OAuth2 authorization URL
 */
export function getAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent'
  });
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: GOOGLE_REDIRECT_URI
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to exchange code for tokens');
  }
  
  return response.json();
}

/**
 * Refresh the access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to refresh access token');
  }
  
  return response.json();
}

/**
 * Get available time slots from Google Calendar
 */
export async function getAvailableSlots(
  accessToken: string,
  startDate: Date,
  endDate: Date,
  calendarId: string = 'primary'
): Promise<TimeSlot[]> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/freeBusy`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        items: [{ id: calendarId }]
      })
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch availability');
  }
  
  const data = await response.json();
  const busyPeriods = data.calendars?.[calendarId]?.busy || [];
  
  // Generate all possible time slots and filter out busy ones
  const slots = generateTimeSlots(startDate, endDate, busyPeriods);
  return slots;
}

interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}

interface BusyPeriod {
  start: string;
  end: string;
}

function generateTimeSlots(startDate: Date, endDate: Date, busyPeriods: BusyPeriod[]): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const current = new Date(startDate);
  
  // Set working hours (9 AM - 6 PM)
  const startHour = 9;
  const endHour = 18;
  
  while (current < endDate) {
    // Reset to start of day
    current.setHours(startHour, 0, 0, 0);
    
    // Generate slots for each day
    for (let hour = startHour; hour < endHour; hour++) {
      const slotStart = new Date(current);
      slotStart.setHours(hour, 0, 0, 0);
      
      const slotEnd = new Date(current);
      slotEnd.setHours(hour + 1, 0, 0, 0);
      
      // Check if slot overlaps with any busy period
      const isBusy = busyPeriods.some(busy => {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        return slotStart < busyEnd && slotEnd > busyStart;
      });
      
      slots.push({
        start: slotStart,
        end: slotEnd,
        available: !isBusy
      });
    }
    
    // Move to next day
    current.setDate(current.getDate() + 1);
  }
  
  return slots;
}

/**
 * Create an availability block (event) in Google Calendar
 */
export async function createAvailabilityBlock(
  accessToken: string,
  start: Date,
  end: Date,
  title: string = 'Available',
  calendarId: string = 'primary'
): Promise<string> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: title,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        colorId: '9' // Green
      })
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to create availability block');
  }
  
  const data = await response.json();
  return data.id;
}

/**
 * Delete an availability block
 */
export async function deleteAvailabilityBlock(
  accessToken: string,
  eventId: string,
  calendarId: string = 'primary'
): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to delete availability block');
  }
}

/**
 * Check if user has connected their Google Calendar
 */
export function hasCalendarConnection(): boolean {
  // Check for stored tokens (implementation depends on your storage solution)
  return false; // Override with actual check
}

/**
 * Get stored tokens (implement based on your storage)
 */
export async function getStoredTokens(): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
} | null> {
  // TODO: Implement based on your database/storage solution
  // This should return null if no connection exists
  return null;
}

/**
 * Store tokens (implement based on your storage)
 */
export async function storeTokens(tokens: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}): Promise<void> {
  // TODO: Implement based on your database/storage solution
  // Store: tokens.access_token, tokens.refresh_token, expires_at = now + tokens.expires_in
  console.log('Storing tokens:', tokens);
}
