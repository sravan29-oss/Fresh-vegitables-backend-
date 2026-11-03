-- ============================================================
-- Migration 010: Google Authentication for Customer Accounts
-- ============================================================

-- Add google_id column for verified Google UID linking
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

-- Ensure password is nullable for customers signing up with Google
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- Ensure email is nullable if phone-only users exist, but keep unique
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Create index on google_id for lightning-fast customer lookup
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
