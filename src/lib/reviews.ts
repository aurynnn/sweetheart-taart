// src/lib/reviews.ts — Review requests after pickup, star ratings and feedback.
//
// Flow: the day after pickup (or as soon as an order is marked "voltooid") the
// customer gets an e-mail with 5 clickable stars. Each star links to /beoordeling
// with a signed token. 5 stars → thank you + Google review; 1–4 stars → a short
// feedback form on our own site so we can improve.

import { d1Query } from './d1';
import { signToken, verifyToken } from './tokens';
import { toLocalDateStr } from './availability';
import { belgianNow } from './dates';

// Same DDL as migrations/0007_review_requests.sql — additive, safe to run repeatedly
const DDL = `CREATE TABLE IF NOT EXISTS review_requests (
  order_id   TEXT PRIMARY KEY,
  sent_at    TEXT,
  rating     INTEGER,
  liked      TEXT,
  feedback   TEXT,
  rated_at   TEXT
)`;

let ensured = false;
export async function ensureReviewTable() {
  if (ensured) return;
  await d1Query(DDL);
  ensured = true;
}

export const reviewToken = (orderId: string) => signToken('review', orderId);
export const verifyReviewToken = (orderId: string, token: string) => verifyToken('review', orderId, token);

export interface ReviewRow { order_id: string; sent_at: string | null; rating: number | null; liked: string | null; feedback: string | null; rated_at: string | null }

export async function getReview(orderId: string): Promise<ReviewRow | null> {
  await ensureReviewTable();
  const res = await d1Query('SELECT * FROM review_requests WHERE order_id = ?', [orderId]);
  return (res.results?.[0] as ReviewRow) ?? null;
}

/** Marks the request as sent; returns false if it was already sent (so it goes out only once). */
export async function claimReviewRequest(orderId: string): Promise<boolean> {
  await ensureReviewTable();
  const existing = await getReview(orderId);
  if (existing?.sent_at) return false;
  await d1Query(
    `INSERT INTO review_requests (order_id, sent_at) VALUES (?, datetime('now'))
     ON CONFLICT(order_id) DO UPDATE SET sent_at = datetime('now') WHERE sent_at IS NULL`,
    [orderId]
  );
  return true;
}

export async function releaseReviewRequest(orderId: string) {
  await d1Query('UPDATE review_requests SET sent_at = NULL WHERE order_id = ? AND rating IS NULL', [orderId]);
}

export async function saveRating(orderId: string, rating: number) {
  await ensureReviewTable();
  await d1Query(
    `INSERT INTO review_requests (order_id, rating, rated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(order_id) DO UPDATE SET rating = excluded.rating, rated_at = excluded.rated_at`,
    [orderId, rating]
  );
}

export async function saveFeedback(orderId: string, liked: string[], feedback: string) {
  await ensureReviewTable();
  await d1Query(
    `INSERT INTO review_requests (order_id, liked, feedback) VALUES (?, ?, ?)
     ON CONFLICT(order_id) DO UPDATE SET liked = excluded.liked, feedback = excluded.feedback`,
    [orderId, liked.join(', '), feedback]
  );
}

/**
 * Orders whose pickup was yesterday or earlier (max. 7 days ago, so old orders never
 * get a surprise mail) and that are approved/completed without a review request yet.
 */
export async function dueReviewOrderIds(): Promise<string[]> {
  await ensureReviewTable();
  const today = belgianNow();
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
  const res = await d1Query(
    `SELECT o.id FROM orders o
     LEFT JOIN review_requests r ON r.order_id = o.id
     WHERE o.status IN ('approved', 'completed')
       AND o.date < ? AND o.date >= ?
       AND (r.sent_at IS NULL)`,
    [toLocalDateStr(today), toLocalDateStr(weekAgo)]
  );
  return (res.results || []).map((r: any) => r.id as string);
}

export async function reviewStats() {
  await ensureReviewTable();
  const [agg, recent] = await Promise.all([
    d1Query('SELECT COUNT(rating) as n, AVG(rating) as avg, SUM(CASE WHEN sent_at IS NOT NULL THEN 1 ELSE 0 END) as sent FROM review_requests'),
    d1Query(`SELECT order_id, rating, liked, feedback, rated_at FROM review_requests
             WHERE rating IS NOT NULL ORDER BY rated_at DESC LIMIT 6`),
  ]);
  const row: any = agg.results?.[0] ?? {};
  return { count: Number(row.n) || 0, average: Number(row.avg) || 0, sent: Number(row.sent) || 0, recent: (recent.results || []) as ReviewRow[] };
}
