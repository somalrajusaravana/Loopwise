-- ============================================================
-- LoopWise Migration 003: Points, Streak & Reward System
-- ============================================================
-- Adds:
--   points_log      — audit trail for every point award (idempotent)
--   daily_checkins  — one participation credit per student per day
-- Safe to run multiple times (uses IF NOT EXISTS).
-- ============================================================

-- 1. Points log — every point award is recorded here
CREATE TABLE IF NOT EXISTS points_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  points INT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'verified_observation',
    'weekly_streak_bonus',
    'suggestion_adopted',
    'feedback_submitted',
    'before_after_bonus',
    'daily_checkin'
  )),
  reference_id TEXT NOT NULL,
  reference_type TEXT NOT NULL CHECK (reference_type IN (
    'observation',
    'suggestion',
    'feedback',
    'checkin',
    'streak'
  )),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Idempotency: same user + same reference = only one award
CREATE UNIQUE INDEX IF NOT EXISTS idx_points_log_unique_award
  ON points_log (user_id, reference_id, reason);

-- Fast lookups for user history
CREATE INDEX IF NOT EXISTS idx_points_log_user_created
  ON points_log (user_id, created_at DESC);

-- 2. Daily check-ins — one per student per calendar day
CREATE TABLE IF NOT EXISTS daily_checkins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  checkin_type TEXT NOT NULL CHECK (checkin_type IN ('observation', 'nothing_to_report')),
  checkin_date DATE NOT NULL,
  observation_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, checkin_date)
);

-- Fast streak queries: get consecutive days for a user
CREATE INDEX IF NOT EXISTS idx_checkins_user_date
  ON daily_checkins (user_id, checkin_date DESC);

-- 3. Add daily_observation_count column to users for quick limit checks
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_observation_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_observation_date DATE;
