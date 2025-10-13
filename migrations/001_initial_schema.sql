-- Migration: 001_initial_schema.sql
-- Description: Initial database schema for Sbuddy
-- Date: 2025-10-12

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ======================
-- TENANTS & USERS
-- ======================

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  subscription_tier VARCHAR(50) DEFAULT 'free',
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  subscription_tier VARCHAR(50) DEFAULT 'free',
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email_verified BOOLEAN DEFAULT FALSE,
  oauth_provider VARCHAR(50),
  oauth_id VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  two_factor_secret VARCHAR(255),
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================
-- AUTHENTICATION TOKENS
-- ======================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================
-- PROBLEMS
-- ======================

CREATE TABLE IF NOT EXISTS problems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  source VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  difficulty VARCHAR(50) DEFAULT 'medium',
  subject VARCHAR(100) NOT NULL,
  exam_type VARCHAR(100),
  exam_year INTEGER,
  problem_number INTEGER,
  tags TEXT[],
  solution TEXT,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================
-- USER PROGRESS & STUDY
-- ======================

CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  attempts INTEGER DEFAULT 0,
  correct_attempts INTEGER DEFAULT 0,
  last_reviewed_at TIMESTAMP,
  next_review_at TIMESTAMP,
  difficulty_rating DECIMAL(3,2) DEFAULT 2.5,
  mastery_level VARCHAR(50) DEFAULT 'learning',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, problem_id)
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  problems UUID[],
  session_type VARCHAR(50) DEFAULT 'practice',
  score DECIMAL(5,2),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spaced_repetition_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  interval INTEGER DEFAULT 1,
  repetitions INTEGER DEFAULT 0,
  easiness DECIMAL(3,2) DEFAULT 2.5,
  next_review TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, problem_id)
);

-- ======================
-- GAMIFICATION
-- ======================

CREATE TABLE IF NOT EXISTS user_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  total_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak_days INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  problems_solved INTEGER DEFAULT 0,
  achievements TEXT[] DEFAULT '{}',
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================
-- INDEXES
-- ======================

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);

-- Token indexes
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);

-- Problem indexes
CREATE INDEX IF NOT EXISTS idx_problems_tenant ON problems(tenant_id);
CREATE INDEX IF NOT EXISTS idx_problems_category ON problems(category);
CREATE INDEX IF NOT EXISTS idx_problems_exam ON problems(exam_type, exam_year);
CREATE INDEX IF NOT EXISTS idx_problems_subject ON problems(subject);

-- Progress indexes
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_problem ON user_progress(problem_id);
CREATE INDEX IF NOT EXISTS idx_spaced_repetition_next_review ON spaced_repetition_cards(next_review);
CREATE INDEX IF NOT EXISTS idx_spaced_repetition_user ON spaced_repetition_cards(user_id);

-- Gamification indexes
CREATE INDEX IF NOT EXISTS idx_user_scores_user ON user_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_user_scores_points ON user_scores(total_points DESC);

-- ======================
-- FULL-TEXT SEARCH
-- ======================

-- Add tsvector column for full-text search on problems
ALTER TABLE problems ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create trigger to update search_vector
CREATE OR REPLACE FUNCTION problems_search_trigger() RETURNS trigger AS $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.content,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.solution,'')), 'C');
  return new;
end
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tsvectorupdate ON problems;
CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
    ON problems FOR EACH ROW EXECUTE FUNCTION problems_search_trigger();

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_problems_search ON problems USING GIN(search_vector);

-- ======================
-- COMMENTS
-- ======================

COMMENT ON TABLE users IS 'User accounts with multi-tenancy and OAuth support';
COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for session management';
COMMENT ON TABLE email_verification_tokens IS 'Email verification tokens (24h expiry)';
COMMENT ON TABLE password_reset_tokens IS 'Password reset tokens (1h expiry, single-use)';
COMMENT ON TABLE problems IS 'Problem repository with full-text search';
COMMENT ON TABLE user_progress IS 'User progress tracking per problem';
COMMENT ON TABLE spaced_repetition_cards IS 'SM-2 spaced repetition scheduling';
COMMENT ON TABLE user_scores IS 'Gamification: points, levels, achievements, streaks';
