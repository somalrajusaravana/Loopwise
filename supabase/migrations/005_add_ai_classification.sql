-- ============================================================
-- Migration 005: Add AI Classification columns to observations
-- Stores the AI-predicted category and confidence from the
-- classify-image Edge Function (Gemini Vision).
-- ============================================================

ALTER TABLE observations ADD COLUMN IF NOT EXISTS ai_category TEXT;
ALTER TABLE observations ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(5,4);
