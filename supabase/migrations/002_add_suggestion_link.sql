-- ============================================================
-- LoopWise Migration 002: Link actions to source suggestions
-- ============================================================
-- Adds a foreign key from reduction_actions to student_suggestions
-- so Eco Club actions created from suggestions are traceable.
-- Safe to run multiple times (uses IF NOT EXISTS).
-- ============================================================

ALTER TABLE reduction_actions
ADD COLUMN IF NOT EXISTS source_suggestion_id TEXT
REFERENCES student_suggestions(id);
