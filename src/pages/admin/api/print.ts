import type { APIRoute } from 'astro';
import PDFDocument from 'pdfkit';
import { d1Query } from '../../../lib/d1';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { orderIds } = await request.json();

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Geen bestellingen geselecteerd' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch orders with customer and items
    const placeholders = orderIds.map(() => '?').join(',');
    const ordersResult = await d1Query(
      `SELECT o.id, o.date, o.status, o.total, o.message,
              c.firstname, c.lastname, c.email, c.phone
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE o.id IN (${placeholders})`,
      orderIds
    );

    if (!ordersResult.results || ordersResult.results.length === 0) {
      return new Response(JSON.stringify({ error: 'Geen bestellingen gevonden' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch items for each order
    const orders = [];
    for (const row of ordersResult.results || []) {
      const itemsResult = await d1Query(
        'SELECT product, event, persons, flavor, allergies, price FROM order_items WHERE order_id = ?',
        [row.id]
      );
      orders.push({
        ...row,
        items: itemsResult.results || [],
      });
    }

    // Generate PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    const statusLabels: Record<string, string> = {
      pending: 'In afwachting',
      approved: 'Goedgekeurd',
      completed: 'Voltooid',
      cancelled: 'Geannuleerd',
    };

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('Sweetheart Bakery', 50, 50);
    doc.fontSize(12).font('Helvetica').text(`Bestellingen - ${new Date().toLocaleDateString('nl-BE')}`, 50, 75);
    doc.moveTo(50, 95).lineTo(545, 95).stroke();

    let y = 110;

    for (const order of orders) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      const cardHeight = 130;

      // Card background
      doc.rect(50, y, 495, cardHeight).fillAndStroke('#fdf0f2', '#E8788A');

      // Header bar
      doc.rect(50, y, 495, 25).fillAndStroke('#E8788A', '#E8788A');

      // Order ID + Status
      doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
        .text(`${order.id}`, 60, y + 7);
      doc.text(statusLabels[order.status] || order.status, 480, y + 7, { width: 55, align: 'right' });

      // Date
      doc.fillColor('#1e293b').fontSize(9).font('Helvetica')
        .text(new Date(order.date + 'T00:00:00').toLocaleDateString('nl-BE', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }), 60, y + 30);

      // Customer info
      const customerName = [order.firstname, order.lastname].filter(Boolean).join(' ') || 'Onbekend';
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b').text(customerName, 60, y + 48);
      doc.font('Helvetica').fontSize(9).fillColor('#64748b');
      if (order.email) doc.text(order.email, 60, y + 63);
      if (order.phone) doc.text(order.phone, 200, y + 63);

      // Items
      doc.fillColor('#1e293b').fontSize(9);
      let itemY = y + 78;
      for (const item of order.items || []) {
        const itemText = `${item.product}${item.event ? ` (${item.event})` : ''}${item.flavor ? ` - ${item.flavor}` : ''}${item.persons ? ` - ${item.persons} personen` : ''}`;
        doc.text(itemText, 60, itemY);
        itemY += 13;
      }

      // Total + message
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b').text(order.total || '€0.00', 60, y + cardHeight - 22);
      if (order.message) {
        doc.font('Helvetica').fontSize(8).fillColor('#64748b')
          .text(`Opmerking: ${order.message}`, 120, y + cardHeight - 22, { width: 320 });
      }

      y += cardHeight + 15;
    }

    // Get PDF as buffer
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="bestellingen-${Date.now()}.pdf"`,
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message ?? 'Failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
