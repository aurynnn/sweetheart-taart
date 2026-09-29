import { todayIso } from '../../../lib/dates';
import type { APIRoute } from 'astro';
import { listOrders } from '../../../lib/orderRepo';
import { getObject } from '../../../lib/r2';
import { isUploadKey } from '../../../lib/catalog';
import { renderBakingSheet, type PhotoMap } from '../../../lib/pdf/bakingSheet';

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

/** Fetch the customers' example photos (JPEG/PNG only — pdfkit can't embed WebP). */
async function loadPhotos(keys: string[]): Promise<PhotoMap> {
  const photos: PhotoMap = new Map();
  await Promise.all(keys.filter(isUploadKey).map(async (key) => {
    try {
      const res = await getObject(key);
      if (!res.ok) return;
      const buf = Buffer.from(await res.arrayBuffer());
      const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
      const isPng = buf[0] === 0x89 && buf[1] === 0x50;
      if (isJpeg || isPng) photos.set(key, buf);
    } catch { /* print without that photo */ }
  }));
  return photos;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { orderIds } = await request.json();
    if (!Array.isArray(orderIds) || orderIds.length === 0 || orderIds.length > 100) {
      return json({ error: 'Geen aanvragen geselecteerd' }, 400);
    }

    const orders = await listOrders({ ids: orderIds.map(String) });
    if (!orders.length) return json({ error: 'Geen aanvragen gevonden' }, 404);

    const photos = await loadPhotos(orders.flatMap((o) => o.items.map((i) => i.image).filter(Boolean) as string[]));
    const doc = renderBakingSheet(orders, photos);

    const chunks: Buffer[] = [];
    const pdf = await new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="sweetheart-te-maken-${todayIso()}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('[admin/api/print] failed:', error);
    return json({ error: 'PDF maken mislukt' }, 500);
  }
};
