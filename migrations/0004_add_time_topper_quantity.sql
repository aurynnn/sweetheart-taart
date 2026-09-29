-- Migration: add time, topper, and quantity fields
-- Run with: wrangler d1 execute sweetheart-db --file=migrations/0004_add_fields.sql

-- Add time column to orders (pickup time slot)
ALTER TABLE orders ADD COLUMN time TEXT;

-- Add topper column to order_items (feesttaart decoration preference)
ALTER TABLE order_items ADD COLUMN topper TEXT;

-- Add missing quantity column to order_items (koekjes/mini-gebak count)
ALTER TABLE order_items ADD COLUMN quantity INTEGER DEFAULT 1;
