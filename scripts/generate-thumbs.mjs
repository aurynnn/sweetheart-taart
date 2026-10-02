// Makes small preview images for the collection galleries and uploads them to R2 next to
// the original as `<name>_thumb.webp` (400px wide). Photos are resized, videos get a frame
// from 0.5s in. Files that already have a thumb are skipped, so re-run after adding photos.
// The site (src/lib/r2.ts) picks the thumbs up automatically and keeps them out of the gallery.
// Needs ImageMagick (`magick`) and ffmpeg. Usage: npm run thumbs [-- --force]
import { AwsClient } from 'aws4fetch';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const aws = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
const base = `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME || 'sweetheart'}`;

const COLLECTIONS = ['feestcollectie', 'mini-collectie', 'koekjescollectie'];
const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i;
const VIDEO = /\.(mp4|webm|mov)$/i;
const SKIP = /\/(sofie|vanessa|gilles|nathalie)[^/]*$|_thumb\.[a-z]+$/i; // same as NOT_GALLERY in r2.ts
const WIDTH = 400;
const force = process.argv.includes('--force');

const thumbKey = (key) => key.replace(/\.[^.]+$/, '_thumb.webp');
const keyUrl = (key) => `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;

async function listKeys(prefix) {
  const keys = [];
  let token = '';
  do {
    const res = await aws.fetch(`${base}?list-type=2&max-keys=1000&prefix=${encodeURIComponent(prefix)}${token ? `&continuation-token=${encodeURIComponent(token)}` : ''}`);
    if (!res.ok) throw new Error(`R2 list failed: ${res.status}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(m[1].replace(/&amp;/g, '&'));
    token = xml.match(/<NextContinuationToken>([^<]+)</)?.[1] ?? '';
  } while (token);
  return keys;
}

const magick = (input, args = []) =>
  execFileSync('magick', ['-', '-auto-orient', ...args, '-resize', `${WIDTH}x>`, '-strip', '-quality', '72', 'webp:-'], { input, maxBuffer: 64 << 20 });

async function makeThumb(key) {
  const res = await aws.fetch(keyUrl(key));
  if (!res.ok) throw new Error(`download ${res.status}`);
  const file = Buffer.from(await res.arrayBuffer());
  let thumb;
  if (VIDEO.test(key)) {
    // ffmpeg needs a seekable file: in many mp4s the index sits at the end
    const dir = mkdtempSync(join(tmpdir(), 'thumb-'));
    try {
      const path = join(dir, 'video' + key.slice(key.lastIndexOf('.')));
      writeFileSync(path, file);
      const frame = execFileSync('ffmpeg', ['-v', 'error', '-ss', '0.5', '-i', path, '-frames:v', '1', '-f', 'image2', '-c:v', 'png', 'pipe:1'], { maxBuffer: 64 << 20 });
      thumb = magick(frame);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  } else {
    thumb = magick(file, key.toLowerCase().endsWith('.gif') ? ['-delete', '1--1'] : []);
  }
  const put = await aws.fetch(keyUrl(thumbKey(key)), {
    method: 'PUT',
    body: thumb,
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000' },
  });
  if (!put.ok) throw new Error(`upload ${put.status}`);
  return [file.length, thumb.length];
}

let done = 0, failed = 0, before = 0, after = 0;
for (const collection of COLLECTIONS) {
  const keys = await listKeys(`${collection}/`);
  const existing = new Set(keys);
  const todo = keys.filter((k) => (IMAGE.test(k) || VIDEO.test(k)) && !SKIP.test(k) && (force || !existing.has(thumbKey(k))));
  console.log(`${collection}: ${todo.length} thumbs to make`);

  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < todo.length) {
      const key = todo[next++];
      try {
        const [a, b] = await makeThumb(key);
        before += a; after += b; done++;
        if (done % 50 === 0) console.log(`  … ${done} done`);
      } catch (err) {
        failed++;
        console.warn(`  ✗ ${key}: ${err.message.split('\n')[0]}`);
      }
    }
  }));
}
console.log(`✓ ${done} thumbs uploaded (${(before / 1e6).toFixed(1)} MB → ${(after / 1e6).toFixed(1)} MB)${failed ? `, ${failed} failed` : ''}`);
