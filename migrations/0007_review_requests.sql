-- Migration: review requests, star ratings and feedback after pickup
-- Run with: wrangler d1 execute sweetheart-db --remote --file=migrations/0007_review_requests.sql
-- (The app also creates this table on first use; this file documents the schema.)

CREATE TABLE IF NOT EXISTS review_requests (
  order_id   TEXT PRIMARY KEY,
  sent_at    TEXT,
  rating     INTEGER,
  liked      TEXT,
  feedback   TEXT,
  rated_at   TEXT
);
