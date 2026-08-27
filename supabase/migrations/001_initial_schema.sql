-- ============================================================
-- LoopWise Round 2 — Initial Schema (TEXT IDs, idempotent)
-- ============================================================
-- Safe to run on a clean OR partially-created database.
-- All IDs use TEXT to support readable IDs like 'u-001', 'obs-001'.
-- ============================================================

-- Drop tables in reverse dependency order (safe if they don't exist)
DROP TABLE IF EXISTS action_feedback CASCADE;
DROP TABLE IF EXISTS student_suggestions CASCADE;
DROP TABLE IF EXISTS reduction_actions CASCADE;
DROP TABLE IF EXISTS observations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Also drop indexes if they exist from a partial run
DROP INDEX IF EXISTS idx_observations_location_category;
DROP INDEX IF EXISTS idx_observations_phash;
DROP INDEX IF EXISTS idx_feedback_action_id;

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('student', 'eco-club')),
  points INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Observations
CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  plastic_category TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  photo_storage_path TEXT,
  photo_phash TEXT,
  flagged_for_review BOOLEAN DEFAULT false,
  points_awarded INT DEFAULT 10,
  reporter_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for hotspot computation (group by location + category)
CREATE INDEX IF NOT EXISTS idx_observations_location_category
  ON observations (location, plastic_category);

-- Index for pHash duplicate detection
CREATE INDEX IF NOT EXISTS idx_observations_phash
  ON observations (photo_phash)
  WHERE photo_phash IS NOT NULL;

-- 3. Reduction Actions
CREATE TABLE IF NOT EXISTS reduction_actions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('suggested', 'adopted', 'active', 'completed')) DEFAULT 'suggested',
  linked_hotspot_location TEXT,
  linked_hotspot_category TEXT,
  created_by TEXT REFERENCES users(id),
  assigned_to TEXT,
  start_date DATE,
  completed_date DATE,
  notes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Action Feedback
CREATE TABLE IF NOT EXISTS action_feedback (
  id TEXT PRIMARY KEY,
  action_id TEXT REFERENCES reduction_actions(id) ON DELETE CASCADE,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  comment TEXT,
  photo_storage_path TEXT,
  location TEXT,
  reporter_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for feedback queries by action
CREATE INDEX IF NOT EXISTS idx_feedback_action_id ON action_feedback (action_id);

-- 5. Student Suggestions
CREATE TABLE IF NOT EXISTS student_suggestions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  explanation TEXT,
  related_location TEXT,
  status TEXT CHECK (status IN ('pending', 'adopted', 'dismissed')) DEFAULT 'pending',
  reporter_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Hotspots are NOT stored — they are computed at query time.
-- ============================================================

-- ============================================================
-- Seed Data (existing mock data with readable TEXT IDs)
-- ============================================================

-- Users
INSERT INTO users (id, name, role, points) VALUES
  ('u-001', 'Alex Chen', 'student', 40),
  ('u-002', 'Priya Sharma', 'student', 20),
  ('u-003', 'Marcus Johnson', 'student', 20),
  ('u-004', 'Fatima Al-Rashid', 'student', 10),
  ('u-005', 'Liam O''Brien', 'student', 20),
  ('u-006', 'Sofia Nguyen', 'student', 10),
  ('u-007', 'Jordan Taylor', 'student', 10),
  ('u-008', 'Amara Okafor', 'student', 5);

-- Observations
INSERT INTO observations (id, plastic_category, location, description, photo_phash, flagged_for_review, points_awarded, reporter_id, created_at) VALUES
  ('obs-001', 'cups-lids', 'Dining Hall', 'Piled up disposable coffee cups near the trash station. Bins were overflowing.', 'a3f1b2c4', false, 10, 'u-001', '2026-08-25T12:30:00Z'),
  ('obs-002', 'straws', 'Café / Coffee Shop', 'Dozens of plastic straws in the bin by the espresso bar. They''re still using plastic ones.', null, false, 10, 'u-002', '2026-08-25T09:15:00Z'),
  ('obs-003', 'food-packaging', 'Dining Hall', 'Takeout containers stacked on tables. Most are single-use plastic with no recycling option.', null, false, 10, 'u-003', '2026-08-24T18:00:00Z'),
  ('obs-004', 'bags', 'Student Center', 'Plastic bags handed out at the campus bookstore. Reusable bags are available but not promoted.', null, false, 10, 'u-004', '2026-08-24T14:20:00Z'),
  ('obs-005', 'bottles', 'Gym', 'Recycling bin for water bottles is broken. Students are throwing plastic bottles in regular trash.', 'd4e2f3a5', false, 10, 'u-005', '2026-08-23T17:45:00Z'),
  ('obs-006', 'utensils', 'Dining Hall', 'Single-use plastic forks and knives still being provided despite the compostable switch last month.', null, false, 10, 'u-006', '2026-08-23T12:10:00Z'),
  ('obs-007', 'containers', 'Library', 'Vending machines sell drinks in plastic bottles only. No refill station nearby.', null, false, 10, 'u-007', '2026-08-22T15:30:00Z'),
  ('obs-008', 'cups-lids', 'Dining Hall', 'Coffee station still provides plastic lids. Same cups piled up from yesterday''s observation.', 'a3f1b2c5', true, 5, 'u-008', '2026-08-22T11:00:00Z'),
  ('obs-009', 'cups-lids', 'Café / Coffee Shop', 'Another round of disposable cups left at outdoor tables. This happens every morning.', null, false, 10, 'u-001', '2026-08-21T08:30:00Z'),
  ('obs-010', 'food-packaging', 'Lecture Halls', 'Students bring in takeout in plastic containers. No compost or recycling bins in lecture halls.', null, false, 10, 'u-002', '2026-08-20T13:15:00Z'),
  ('obs-011', 'cups-lids', 'Dining Hall', 'Compostable cup swap hasn''t started in the main dining area yet. Still all plastic.', null, false, 10, 'u-003', '2026-08-26T12:00:00Z'),
  ('obs-012', 'cups-lids', 'Dining Hall', 'Plastic lids still available at every drink station. No compostable alternative offered.', null, false, 10, 'u-005', '2026-08-27T08:30:00Z'),
  ('obs-013', 'straws', 'Café / Coffee Shop', 'Straws in the self-serve dispenser are still plastic. No paper alternative visible.', null, false, 10, 'u-006', '2026-08-26T14:45:00Z'),
  ('obs-014', 'food-packaging', 'Dining Hall', 'Styrofoam containers at the salad bar station. Compostable ones not being used.', null, false, 10, 'u-007', '2026-08-25T17:20:00Z'),
  ('obs-015', 'bottles', 'Gym', 'Recycling bin is fixed but still no bottle return or refill station nearby.', null, false, 10, 'u-001', '2026-08-26T16:00:00Z');

-- Reduction Actions
INSERT INTO reduction_actions (id, title, description, status, linked_hotspot_location, linked_hotspot_category, created_by, assigned_to, start_date, completed_date, notes) VALUES
  ('act-001', 'Switch Dining Hall to Compostable Cups & Lids', 'Work with dining services to replace all single-use plastic cups and lids in the main Dining Hall with compostable alternatives within 60 days.', 'active', 'Dining Hall', 'cups-lids', 'u-001', 'Eco Club + Dining Services', '2026-08-22', NULL, ARRAY['Vendor quotes received on 8/23', 'Pilot started in south dining area on 8/25']),
  ('act-002', 'Eliminate Plastic Straws at Campus Cafés', 'Partner with the café chain to remove plastic straws entirely and offer paper alternatives or no-straw default.', 'adopted', 'Café / Coffee Shop', 'straws', 'u-001', 'Eco Club', NULL, NULL, ARRAY['Meeting with café manager scheduled for 8/28']),
  ('act-003', 'Add Bottle Return & Refill Station at Gym', 'Install a water bottle refill station and bottle return bin near the gym entrance to reduce plastic bottle waste.', 'suggested', 'Gym', 'bottles', 'u-001', 'Unassigned', NULL, NULL, ARRAY[]::TEXT[]),
  ('act-004', 'Replace Plastic Bags at Campus Bookstore', 'Transition bookstore to paper bags and promote reusable bag discounts.', 'completed', 'Student Center', 'bags', 'u-001', 'Eco Club + Bookstore', '2026-08-12', '2026-08-20', ARRAY['Bookstore now charges $0.10 for paper bags', 'Reusable bags available at checkout for $2']);

-- Action Feedback
INSERT INTO action_feedback (id, action_id, sentiment, comment, location, reporter_id, created_at) VALUES
  ('fb-001', 'act-001', 'positive', 'I noticed the south dining area now has compostable cups! Great progress.', 'Dining Hall', 'u-006', '2026-08-25'),
  ('fb-002', 'act-001', 'positive', 'Compostable cups are available near the main entrance. Still some plastic ones near the back though.', 'Dining Hall', 'u-005', '2026-08-25'),
  ('fb-003', 'act-001', 'neutral', 'I see the new cups but haven''t confirmed if they''re actually compostable. Need to check labels.', 'Dining Hall', 'u-007', '2026-08-26'),
  ('fb-004', 'act-001', 'positive', 'The compostable cups work great! Way better than the old plastic ones. Back section still has plastic though.', 'Dining Hall', 'u-008', '2026-08-26'),
  ('fb-005', 'act-001', 'positive', 'Confirmed: new cups say "compostable" on the bottom. Nice work!', 'Dining Hall', 'u-002', '2026-08-27'),
  ('fb-006', 'act-004', 'positive', 'Bookstore switched to paper bags. I didn''t see any plastic bags today.', 'Student Center', 'u-003', '2026-08-22'),
  ('fb-007', 'act-004', 'positive', 'Paper bags only now! And there''s a sign promoting the reusable bag option.', 'Student Center', 'u-004', '2026-08-23'),
  ('fb-008', 'act-004', 'positive', 'Can confirm no plastic bags at the bookstore. Completely switched over.', 'Student Center', 'u-001', '2026-08-24');
