-- Migration: occasion reminders ("herinner me 1 maand op voorhand") and marketing opt-outs
-- Run with: wrangler d1 execute sweetheart-db --remote --file=migrations/0008_reminders_optouts.sql
-- (The app also creates these tables on first use; this file documents the schema.)

CREATE TABLE IF NOT EXISTS reminders (
  id           TEXT PRIMARY KEY,                 -- random UUID, never guessable
  email        TEXT NOT NULL,
  customer_id  TEXT,                             -- set when it came from a customer link
  name         TEXT,                             -- for whom, e.g. "Emma"
  occasion     TEXT NOT NULL,                    -- verjaardag, communie, ...
  event_date   TEXT NOT NULL,                    -- next occurrence, YYYY-MM-DD
  remind_at    TEXT NOT NULL,                    -- event_date minus 30 days
  yearly       INTEGER NOT NULL DEFAULT 1,
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending (awaiting confirm) | active | sent | cancelled
  source       TEXT,                             -- 'mail' (signed link) | 'website'
  consent_at   TEXT,                             -- when the customer confirmed (GDPR proof of consent)
  last_sent_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders (status, remind_at);
CREATE INDEX IF NOT EXISTS idx_reminders_email ON reminders (email);

-- Addresses that asked not to receive marketing mails (review requests, reminders).
-- Transactional mails about an aanvraag are still sent.
CREATE TABLE IF NOT EXISTS email_optouts (
  email      TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
