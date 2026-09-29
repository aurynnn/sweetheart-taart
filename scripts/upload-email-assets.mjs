// Uploads public/email/* to the R2 bucket under email-assets/ (images in e-mails must be publicly hosted).
// Usage: npm run upload:email-assets
import { AwsClient } from 'aws4fetch';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const aws = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
const bucket = env.R2_BUCKET_NAME || 'sweetheart';
const base = `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}`;
const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif' };

for (const file of readdirSync('public/email')) {
  const ext = file.slice(file.lastIndexOf('.'));
  if (!types[ext]) continue;
  const res = await aws.fetch(`${base}/email-assets/${file}`, {
    method: 'PUT',
    body: readFileSync(join('public/email', file)),
    headers: { 'Content-Type': types[ext], 'Cache-Control': 'public, max-age=31536000' },
  });
  console.log(`${res.ok ? '✓' : '✗'} email-assets/${file} (${res.status})`);
}
