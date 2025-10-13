-- Migration: 002_add_study_sets.sql
-- Description: Add study sets feature for organizing problems
-- Date: 2025-10-12

-- ======================
-- STUDY SETS
-- ======================

CREATE TABLE IF NOT EXISTS study_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Junction table for many-to-many relationship between study_sets and problems
CREATE TABLE IF NOT EXISTS study_set_problems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  study_set_id UUID REFERENCES study_sets(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  custom_notes TEXT,
  UNIQUE(study_set_id, problem_id)
);

-- ======================
-- INDEXES
-- ======================

CREATE INDEX IF NOT EXISTS idx_study_sets_user ON study_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sets_public ON study_sets(is_public);
CREATE INDEX IF NOT EXISTS idx_study_sets_created ON study_sets(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_set_problems_set ON study_set_problems(study_set_id);
CREATE INDEX IF NOT EXISTS idx_study_set_problems_problem ON study_set_problems(problem_id);

-- ======================
-- COMMENTS
-- ======================

COMMENT ON TABLE study_sets IS 'User-created study sets for organizing problems';
COMMENT ON TABLE study_set_problems IS 'Junction table linking study sets to problems';
