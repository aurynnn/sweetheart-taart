// src/lib/r2.ts — Cloudflare R2 access via its S3-compatible API.
//   listMedia()   gallery photos/videos per collection (cached in memory)
//   putObject()   store a customer's example photo
//   getObject()   stream it back to the admin panel

import { AwsClient } from 'aws4fetch';
import { env } from './env';

export interface MediaItem {
  src: string;
  alt: string;
  caption: string;
  type: 'image' | 'video';
  /** Small preview (`<name>_thumb.webp`, made by `npm run thumbs`), when it exists */
  thumb?: string;
}

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
const VIDEO_EXT = ['.mp4', '.webm', '.mov'];
const CACHE_MS = 10 * 60_000;
// Customer portraits used by the testimonials live in the same folders
const NOT_GALLERY = /\/(sofie|vanessa|gilles|nathalie)[^/]*$|_thumb\.[a-z]+$/i;
const ALT: Record<string, string> = {
  feestcollectie: 'Feesttaart van Sweetheart',
  'mini-collectie': 'Mini-gebak van Sweetheart',
  koekjescollectie: 'Versierde koekjes van Sweetheart',
};

let client: AwsClient | null = null;

function r2() {
  const accessKeyId = env('R2_ACCESS_KEY_ID');
  const secretAccessKey = env('R2_SECRET_ACCESS_KEY');
  if (!accessKeyId || !secretAccessKey) throw new Error('R2 credentials missing (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)');
  client ??= new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  // R2_BUCKET in .env holds the public r2.dev id, so the bucket name has its own var
  const bucket = env('R2_BUCKET_NAME', 'sweetheart');
  return { client, base: `https://${env('CF_ACCOUNT_ID')}.r2.cloudflarestorage.com/${bucket}` };
}

async function listKeys(prefix: string): Promise<string[]> {
  const { client, base } = r2();
  const keys: string[] = [];
  let token = '';
  do {
    const url = `${base}?list-type=2&max-keys=1000&prefix=${encodeURIComponent(prefix)}${token ? `&continuation-token=${encodeURIComponent(token)}` : ''}`;
    const res = await client.fetch(url);
    if (!res.ok) throw new Error(`R2 list failed: ${res.status}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(m[1].replace(/&amp;/g, '&'));
    token = xml.match(/<NextContinuationToken>([^<]+)</)?.[1] ?? '';
  } while (token);
  return keys;
}

const mediaCache = new Map<string, { at: number; items: MediaItem[] }>();

/** All photos and videos under `<collection>/` in the bucket, newest-looking names first. */
export async function listMedia(collection: string, fallback: MediaItem[] = []): Promise<MediaItem[]> {
  const hit = mediaCache.get(collection);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items;
  try {
    const publicBase = (env('PUBLIC_R2_BASE_URL') || env('R2_DOMAIN') || '').replace(/\/$/, '');
    const keys = await listKeys(`${collection}/`);
    const keySet = new Set(keys);
    const url = (key: string) => `${publicBase}/${key.split('/').map(encodeURIComponent).join('/')}`;
    const items = keys
      .map((key): MediaItem | null => {
        if (NOT_GALLERY.test(key)) return null;
        const ext = key.slice(key.lastIndexOf('.')).toLowerCase();
        const type = IMAGE_EXT.includes(ext) ? 'image' : VIDEO_EXT.includes(ext) ? 'video' : null;
        if (!type) return null;
        const thumbKey = key.replace(/\.[^.]+$/, '_thumb.webp');
        return { src: url(key), thumb: keySet.has(thumbKey) ? url(thumbKey) : undefined, alt: ALT[collection] ?? 'Creatie van Sweetheart', caption: '', type };
      })
      .filter((x): x is MediaItem => !!x)
      .sort((a, b) => b.src.localeCompare(a.src));
    if (items.length) mediaCache.set(collection, { at: Date.now(), items });
    return items.length ? items : fallback;
  } catch (err) {
    console.warn(`[r2] listMedia(${collection}) failed, using fallback:`, (err as Error).message);
    return fallback;
  }
}

export async function putObject(key: string, body: ArrayBuffer | Uint8Array, contentType: string) {
  const { client, base } = r2();
  const res = await client.fetch(`${base}/${key}`, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=31536000, immutable' },
  });
  if (!res.ok) throw new Error(`R2 put failed: ${res.status} ${await res.text()}`);
}

export async function getObject(key: string): Promise<Response> {
  const { client, base } = r2();
  return client.fetch(`${base}/${key}`);
}

export async function deleteObject(key: string) {
  const { client, base } = r2();
  const res = await client.fetch(`${base}/${key}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed: ${res.status}`);
}
