import type { APIRoute } from 'astro';
import { verifyReviewToken, saveRating, saveFeedback } from '../../lib/reviews';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const TOPICS = ['Smaak', 'Uiterlijk', 'Versheid', 'Communicatie', 'Ophalen', 'Prijs'];

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const orderId = String(body?.orderId ?? '');
  if (!/^ORD-\d+$/.test(orderId) || !verifyReviewToken(orderId, String(body?.token ?? ''))) {
    return json({ success: false, error: 'Ongeldige link' }, 403);
  }
  const rating = Number(body?.rating);

  // Score only (sent when the page opens or a star is clicked)
  if (body?.action === 'rate') {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ success: false, error: 'Ongeldige score' }, 400);
    try {
      await saveRating(orderId, rating);
      return json({ success: true });
    } catch (err) {
      console.error('[api/feedback] rating failed:', err);
      return json({ success: false, error: 'Opslaan mislukt' }, 500);
    }
  }

  const topics = Array.isArray(body?.topics) ? body.topics.filter((t: unknown) => TOPICS.includes(String(t))) : [];
  const feedback = typeof body?.feedback === 'string' ? body.feedback.trim().slice(0, 2000) : '';
  if (!feedback && topics.length === 0) return json({ success: false, error: 'Vertel ons kort wat beter kon.' }, 400);

  try {
    if (Number.isInteger(rating) && rating >= 1 && rating <= 5) await saveRating(orderId, rating);
    await saveFeedback(orderId, topics, feedback);
    return json({ success: true });
  } catch (err) {
    console.error('[api/feedback] failed:', err);
    return json({ success: false, error: 'Opslaan mislukt. Probeer het later opnieuw.' }, 500);
  }
};
