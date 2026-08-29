-- ============================================================
-- LoopWise Migration 004: Add Supabase Auth Bridge
-- ============================================================
-- Adds auth_id (UUID) and email columns to users table.
-- Existing TEXT IDs and all foreign keys are preserved.
-- Safe to run multiple times (uses IF NOT EXISTS).
-- ============================================================

-- Add auth_id column to link Supabase Auth users to app users
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add email column for display and lookup
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

-- Create index for fast auth_id lookups (used on every login)
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users (auth_id) WHERE auth_id IS NOT NULL;
