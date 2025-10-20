# Problem Repository Query Examples

## Overview

This document provides practical SQL query examples for working with the scraped AoPS problem repository in Sbuddy.

## Basic Queries

### 1. Find Specific Problem

```sql
-- By exact exam, year, and number
SELECT * FROM problems
WHERE exam_type = 'AMC10'
  AND exam_year = 2024
  AND problem_number = 5
  AND tenant_id = 'your-tenant-id';
```

**Use Case**: When a user identifies a problem by photo, retrieve full details.

### 2. Get All Problems from a Test

```sql
-- Get all 25 problems from 2024 AMC 10A
SELECT id, title, difficulty, problem_number
FROM problems
WHERE exam_type = 'AMC10'
  AND exam_year = 2024
  AND tags @> ARRAY['AMC10A']
  AND tenant_id = 'your-tenant-id'
ORDER BY problem_number ASC;
```

**Use Case**: Create a complete test study set.

### 3. Search by Difficulty

```sql
-- Get all easy problems for beginners
SELECT title, content, difficulty, tags
FROM problems
WHERE difficulty = 'easy'
  AND subject = 'Mathematics'
  AND tenant_id = 'your-tenant-id'
ORDER BY exam_year DESC, problem_number ASC
LIMIT 20;
```

**Use Case**: Generate a beginner-friendly study set.

## Advanced Queries

### 4. Topic-Based Filtering

```sql
-- Find all geometry problems
SELECT title, content, tags, difficulty
FROM problems
WHERE tags @> ARRAY['geometry']
  AND tenant_id = 'your-tenant-id'
ORDER BY difficulty ASC, exam_year DESC;
```

**Use Case**: Focused practice on specific math topics.

### 5. Multi-Tag Search (AND logic)

```sql
-- Find medium difficulty geometry problems from recent years
SELECT title, content, exam_year, problem_number
FROM problems
WHERE tags @> ARRAY['geometry']
  AND difficulty = 'medium'
  AND exam_year >= 2020
  AND tenant_id = 'your-tenant-id'
ORDER BY exam_year DESC;
```

**Use Case**: Targeted practice with multiple filters.

### 6. Multi-Tag Search (OR logic)

```sql
-- Find problems about triangles OR circles
SELECT title, content, tags
FROM problems
WHERE (tags && ARRAY['triangles', 'circles'])
  AND tenant_id = 'your-tenant-id'
ORDER BY exam_year DESC;
```

**Use Case**: Broader topic coverage.

## Full-Text Search

### 7. Keyword Search

```sql
-- Search for problems containing "triangle area"
SELECT title, content, difficulty,
       ts_rank(to_tsvector('english', content), query) AS rank
FROM problems,
     plainto_tsquery('english', 'triangle area') query
WHERE to_tsvector('english', content) @@ query
  AND tenant_id = 'your-tenant-id'
ORDER BY rank DESC
LIMIT 10;
```

**Use Case**: Natural language problem search.

### 8. Multi-Keyword Search

```sql
-- Search for "circle tangent" OR "radius"
SELECT title, content, difficulty
FROM problems
WHERE to_tsvector('english', content) @@
      to_tsquery('english', 'circle & tangent | radius')
  AND tenant_id = 'your-tenant-id'
ORDER BY exam_year DESC;
```

**Use Case**: Complex search patterns.

## Spaced Repetition Queries

### 9. Get Due Cards

```sql
-- Problems due for review today
SELECT p.id, p.title, p.difficulty, sr.next_review_at
FROM problems p
JOIN spaced_repetition_cards sr ON p.id = sr.problem_id
WHERE sr.user_id = 'user-id'
  AND sr.next_review_at <= NOW()
  AND p.tenant_id = 'tenant-id'
ORDER BY sr.next_review_at ASC
LIMIT 10;
```

**Use Case**: Daily review session generation.

### 10. Get Problems by Mastery Level

```sql
-- Get learning-stage problems (not yet mastered)
SELECT p.title, p.content, up.mastery_level, up.attempts
FROM problems p
JOIN user_progress up ON p.id = up.problem_id
WHERE up.user_id = 'user-id'
  AND up.mastery_level = 'learning'
  AND p.tenant_id = 'tenant-id'
ORDER BY up.last_reviewed_at ASC;
```

**Use Case**: Focus on problems needing more practice.

## Study Set Creation

### 11. Progressive Difficulty Study Set

```sql
-- Create a balanced study set with 5 easy, 10 medium, 5 hard
(
  SELECT * FROM problems
  WHERE difficulty = 'easy' AND tenant_id = 'tenant-id'
  ORDER BY RANDOM() LIMIT 5
)
UNION ALL
(
  SELECT * FROM problems
  WHERE difficulty = 'medium' AND tenant_id = 'tenant-id'
  ORDER BY RANDOM() LIMIT 10
)
UNION ALL
(
  SELECT * FROM problems
  WHERE difficulty = 'hard' AND tenant_id = 'tenant-id'
  ORDER BY RANDOM() LIMIT 5
);
```

**Use Case**: Balanced practice sessions.

### 12. Year-Range Study Set

```sql
-- Get recent problems (last 3 years)
SELECT * FROM problems
WHERE exam_year BETWEEN 2022 AND 2024
  AND exam_type = 'AMC10'
  AND tenant_id = 'tenant-id'
ORDER BY exam_year DESC, problem_number ASC;
```

**Use Case**: Current competition preparation.

## Analytics Queries

### 13. Problem Statistics

```sql
-- Count problems by difficulty and year
SELECT
  exam_year,
  difficulty,
  COUNT(*) as problem_count
FROM problems
WHERE tenant_id = 'tenant-id'
GROUP BY exam_year, difficulty
ORDER BY exam_year DESC, difficulty;
```

**Use Case**: Repository statistics dashboard.

### 14. Tag Frequency

```sql
-- Most common tags
SELECT
  unnest(tags) as tag,
  COUNT(*) as frequency
FROM problems
WHERE tenant_id = 'tenant-id'
GROUP BY tag
ORDER BY frequency DESC
LIMIT 20;
```

**Use Case**: Topic coverage analysis.

### 15. User Progress Summary

```sql
-- User's overall progress
SELECT
  p.difficulty,
  up.mastery_level,
  COUNT(*) as count,
  AVG(up.correct_attempts::float / NULLIF(up.attempts, 0)) as accuracy
FROM user_progress up
JOIN problems p ON up.problem_id = p.id
WHERE up.user_id = 'user-id'
  AND p.tenant_id = 'tenant-id'
GROUP BY p.difficulty, up.mastery_level
ORDER BY p.difficulty, up.mastery_level;
```

**Use Case**: Progress tracking and analytics.

## Problem Matching (AI Integration)

### 16. Similar Problem Search

```sql
-- Find problems similar to a given problem (by tags)
SELECT
  p2.id,
  p2.title,
  p2.difficulty,
  (
    SELECT COUNT(*)
    FROM unnest(p1.tags) t1
    WHERE t1 = ANY(p2.tags)
  ) as common_tags
FROM problems p1
CROSS JOIN problems p2
WHERE p1.id = 'source-problem-id'
  AND p2.id != p1.id
  AND p1.tenant_id = p2.tenant_id
ORDER BY common_tags DESC
LIMIT 10;
```

**Use Case**: Recommend related problems after solving one.

### 17. Next-Problem Recommendation

```sql
-- Recommend next problem based on user progress
SELECT p.id, p.title, p.difficulty, p.tags
FROM problems p
WHERE p.tenant_id = 'tenant-id'
  AND p.difficulty = (
    -- Get user's current optimal difficulty
    SELECT
      CASE
        WHEN AVG(correct_attempts::float / NULLIF(attempts, 0)) > 0.8 THEN
          CASE
            WHEN current_difficulty = 'easy' THEN 'medium'
            WHEN current_difficulty = 'medium' THEN 'hard'
            ELSE 'hard'
          END
        ELSE current_difficulty
      END
    FROM (
      SELECT up.*, p2.difficulty as current_difficulty
      FROM user_progress up
      JOIN problems p2 ON up.problem_id = p2.id
      WHERE up.user_id = 'user-id'
      ORDER BY up.last_reviewed_at DESC
      LIMIT 10
    ) recent_problems
  )
  AND NOT EXISTS (
    -- Exclude already attempted problems
    SELECT 1 FROM user_progress up2
    WHERE up2.user_id = 'user-id' AND up2.problem_id = p.id
  )
ORDER BY RANDOM()
LIMIT 5;
```

**Use Case**: Adaptive difficulty progression.

## Gamification Queries

### 18. Leaderboard by Topic

```sql
-- Top performers in geometry
SELECT
  u.id,
  u.email,
  COUNT(*) as geometry_mastered,
  AVG(up.correct_attempts::float / NULLIF(up.attempts, 0)) as accuracy
FROM users u
JOIN user_progress up ON u.id = up.user_id
JOIN problems p ON up.problem_id = p.id
WHERE up.mastery_level = 'mastered'
  AND p.tags @> ARRAY['geometry']
  AND u.tenant_id = 'tenant-id'
GROUP BY u.id, u.email
ORDER BY geometry_mastered DESC, accuracy DESC
LIMIT 10;
```

**Use Case**: Topic-specific leaderboards.

### 19. Daily Challenge Selection

```sql
-- Pick 3 random medium problems not attempted this week
SELECT * FROM problems
WHERE difficulty = 'medium'
  AND tenant_id = 'tenant-id'
  AND id NOT IN (
    SELECT problem_id FROM user_progress
    WHERE user_id = 'user-id'
      AND last_reviewed_at > NOW() - INTERVAL '7 days'
  )
ORDER BY RANDOM()
LIMIT 3;
```

**Use Case**: Daily challenge generation.

## Performance Optimization Tips

### Use Prepared Statements

```javascript
// Node.js with pg
const query = {
  text: 'SELECT * FROM problems WHERE exam_type = $1 AND exam_year = $2',
  values: ['AMC10', 2024]
};
const result = await client.query(query);
```

### Index Usage Verification

```sql
-- Check if query uses indexes
EXPLAIN ANALYZE
SELECT * FROM problems
WHERE tags @> ARRAY['geometry']
  AND difficulty = 'medium';
```

### Common Table Expressions (CTE)

```sql
-- Complex query with CTE for readability
WITH user_topics AS (
  SELECT unnest(p.tags) as topic, COUNT(*) as count
  FROM user_progress up
  JOIN problems p ON up.problem_id = p.id
  WHERE up.user_id = 'user-id'
  GROUP BY topic
)
SELECT p.* FROM problems p
WHERE p.tags && (
  SELECT ARRAY_AGG(topic) FROM user_topics ORDER BY count DESC LIMIT 3
)
AND p.tenant_id = 'tenant-id'
ORDER BY RANDOM()
LIMIT 10;
```

## Query Templates for API Endpoints

### Problem Repository Service

```typescript
// src/services/problemRepository.ts

// Search by filters
async searchProblems(filters: {
  difficulty?: string;
  tags?: string[];
  examType?: string;
  yearFrom?: number;
  yearTo?: number;
  tenantId: string;
}) {
  let query = 'SELECT * FROM problems WHERE tenant_id = $1';
  const values: any[] = [filters.tenantId];
  let paramCount = 1;

  if (filters.difficulty) {
    query += ` AND difficulty = $${++paramCount}`;
    values.push(filters.difficulty);
  }

  if (filters.tags?.length) {
    query += ` AND tags @> $${++paramCount}`;
    values.push(filters.tags);
  }

  if (filters.examType) {
    query += ` AND exam_type = $${++paramCount}`;
    values.push(filters.examType);
  }

  if (filters.yearFrom) {
    query += ` AND exam_year >= $${++paramCount}`;
    values.push(filters.yearFrom);
  }

  if (filters.yearTo) {
    query += ` AND exam_year <= $${++paramCount}`;
    values.push(filters.yearTo);
  }

  return await pool.query(query, values);
}
```

## Conclusion

These query examples cover the main use cases for Sbuddy's problem repository:

✅ Basic problem retrieval
✅ Advanced filtering
✅ Full-text search
✅ Spaced repetition integration
✅ Study set creation
✅ Analytics and reporting
✅ AI-powered recommendations
✅ Gamification features

All queries include multi-tenancy support and are optimized for the recommended index structure.
