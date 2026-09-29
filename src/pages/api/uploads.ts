import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { putObject } from '../../lib/r2';
import { clientIp } from '../../lib/auth';

// Example photos customers attach to a product in their aanvraag.
// The browser already downsizes to ~1600px JPEG; this is the server-side guard.

const MAX_BYTES = 8 * 1024 * 1024;
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

/** Detect the real type from the first bytes instead of trusting the filename/MIME. */
function sniff(bytes: Uint8Array): { ext: string; type: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: 'png', type: 'image/png' };
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return { ext: 'webp', type: 'image/webp' };
  return null;
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientIp(request, clientAddress);
  if (rateLimited(ip)) return json({ success: false, error: 'Te veel uploads. Probeer het over enkele minuten opnieuw.' }, 429);

  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BYTES + 64 * 1024) return json({ success: false, error: 'Deze foto is te groot (max. 8 MB).' }, 413);

  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get('file');
    file = f instanceof File ? f : null;
  } catch {
    return json({ success: false, error: 'Ongeldige upload' }, 400);
  }
  if (!file || file.size === 0) return json({ success: false, error: 'Geen foto ontvangen' }, 400);
  if (file.size > MAX_BYTES) return json({ success: false, error: 'Deze foto is te groot (max. 8 MB).' }, 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return json({ success: false, error: 'Enkel JPG, PNG of WebP foto’s zijn toegestaan.' }, 415);

  const now = new Date();
  const key = `aanvragen/${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}/${randomUUID()}.${kind.ext}`;
  try {
    await putObject(key, bytes, kind.type);
  } catch (err) {
    console.error('[api/uploads] R2 upload failed:', err);
    return json({ success: false, error: 'Uploaden mislukt. Probeer het opnieuw.' }, 502);
  }
  return json({ success: true, key }, 201);
};
