-- Migration: Add crawler-specific fields to problems table
-- Date: 2025-10-22
-- Description: Extends problems table to support rich metadata from crawled AMC problems

-- Add new columns for crawler data
ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS solutions TEXT[],
  ADD COLUMN IF NOT EXISTS images TEXT[],
  ADD COLUMN IF NOT EXISTS answer_choices_image TEXT,
  ADD COLUMN IF NOT EXISTS see_also TEXT[],
  ADD COLUMN IF NOT EXISTS choices JSONB,
  ADD COLUMN IF NOT EXISTS crawl_source_url TEXT,
  ADD COLUMN IF NOT EXISTS crawled_at TIMESTAMP;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_problems_exam_year_number ON problems(exam_year, problem_number);
CREATE INDEX IF NOT EXISTS idx_problems_crawled ON problems(crawled_at) WHERE crawled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_problems_source_url ON problems(crawl_source_url) WHERE crawl_source_url IS NOT NULL;

-- Add unique constraint to prevent duplicate problems from same test
CREATE UNIQUE INDEX IF NOT EXISTS idx_problems_unique_exam_problem
  ON problems(exam_type, exam_year, problem_number, tenant_id);

-- Add comment for documentation
COMMENT ON COLUMN problems.solutions IS 'Array of multiple solution approaches for the problem';
COMMENT ON COLUMN problems.images IS 'Array of image URLs for problem diagrams and figures';
COMMENT ON COLUMN problems.answer_choices_image IS 'URL of rendered answer choices image';
COMMENT ON COLUMN problems.see_also IS 'Array of related problem references';
COMMENT ON COLUMN problems.choices IS 'JSONB data for answer choices';
COMMENT ON COLUMN problems.crawl_source_url IS 'Original source URL from crawler (e.g., AoPS wiki)';
COMMENT ON COLUMN problems.crawled_at IS 'Timestamp when the problem was crawled';
