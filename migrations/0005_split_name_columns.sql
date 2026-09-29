-- Migration: split name into firstname + lastname on customers
-- Run with: wrangler d1 execute sweetheart-db --remote --file=migrations/0005_split_name_columns.sql

-- Add new columns
ALTER TABLE customers ADD COLUMN firstname TEXT;
ALTER TABLE customers ADD COLUMN lastname TEXT;

-- Migrate existing data: if name is like "Firstname Lastname", split it
-- Otherwise leave firstname = name, lastname = empty
UPDATE customers SET
  firstname = TRIM(SUBSTR(name, 1, INSTR(name || ' ', ' ') - 1)),
  lastname  = TRIM(SUBSTR(name, INSTR(name, ' ') + 1))
WHERE name LIKE '% %';
