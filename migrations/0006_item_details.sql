-- Migration: store mini-gebak type and per-product remarks on order items
-- Run with: wrangler d1 execute sweetheart-db --remote --file=migrations/0006_item_details.sql
-- The app works before and after this migration (see src/lib/schema.ts).

ALTER TABLE order_items ADD COLUMN mini_type TEXT;
ALTER TABLE order_items ADD COLUMN message TEXT;
