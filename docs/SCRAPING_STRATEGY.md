# AoPS Problem Scraping & Indexing Strategy

## Overview

This document outlines the strategy for scraping, storing, and indexing problems from Art of Problem Solving (AoPS) for the Sbuddy platform.

## Data Source

**Primary URL**: https://artofproblemsolving.com/wiki/index.php/AMC_10_Problems_and_Solutions

### Page Structure Analysis

#### 1. Index Page Structure
- **URL Pattern**: `/wiki/index.php/AMC_10_Problems_and_Solutions`
- **Content**: List of all AMC 10 tests organized by year
- **Organization**:
  - Chronological (2000-2025)
  - Test versions: A and B per year
  - Links to individual test pages

#### 2. Test Page Structure
- **URL Pattern**: `/wiki/index.php/{YEAR}_AMC_10{A|B}`
- **Example**: `/wiki/index.php/2024_AMC_10A`
- **Content**:
  - Test metadata (date, year)
  - Links to 25 individual problems
  - Answer key link
  - Full test PDF link

#### 3. Problem Page Structure
- **URL Pattern**: `/wiki/index.php/{YEAR}_AMC_10{A|B}_Problems/Problem_{N}`
- **Example**: `/wiki/index.php/2024_AMC_10A_Problems/Problem_1`
- **Content**:
  - Problem statement (LaTeX formatted)
  - Answer choices (A-E for multiple choice)
  - Multiple solution approaches
  - Video solution links
  - "See Also" section with related problems
  - Category tags/topics
  - Images/diagrams (when applicable)

## Scraping Implementation

### Current Implementation (`src/services/aopsScraper.ts`)

#### Key Features

1. **Respectful Crawling**
   - 1-second delay between test pages
   - 200-500ms delay between individual problems
   - Handles 404s gracefully
   - User-agent compliance

2. **Data Extraction Methods**

   ```typescript
   // Core problem data
   - extractProblemContent(): Extract problem statement
   - extractSolutions(): Extract all solution approaches
   - extractAnswerChoices(): Parse multiple choice options

   // Enhanced metadata (newly added)
   - extractTopics(): Extract math topics from categories
   - extractSeeAlso(): Find related problems
   - extractImages(): Detect and extract image URLs
   - inferDifficulty(): Assign difficulty based on problem number
   ```

3. **Difficulty Inference**
   - Problems 1-10: **Easy**
   - Problems 11-20: **Medium**
   - Problems 21-25: **Hard**

   (Based on typical AMC 10 progression)

4. **LaTeX Preservation**
   - Maintains LaTeX delimiters for math rendering
   - Converts HTML entities properly
   - Preserves inline and display math modes

## Database Schema

### Problem Storage Format

```sql
CREATE TABLE problems (
  id UUID PRIMARY KEY,
  title VARCHAR(255),           -- "2024 AMC 10A Problem 1"
  content TEXT,                 -- Problem statement + choices
  source VARCHAR(100),          -- "Art of Problem Solving"
  category VARCHAR(100),        -- "Competition"
  difficulty VARCHAR(50),       -- "easy" | "medium" | "hard"
  subject VARCHAR(100),         -- "Mathematics"
  exam_type VARCHAR(100),       -- "AMC10"
  exam_year INTEGER,            -- 2024
  problem_number INTEGER,       -- 1
  tags TEXT[],                  -- ["AMC10A", "2024", "geometry", ...]
  solution TEXT,                -- First solution approach
  tenant_id UUID,               -- Multi-tenancy support
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Indexing Strategy

#### 1. Primary Indexes
```sql
-- Fast lookup by exam and problem number
CREATE INDEX idx_problems_exam ON problems(exam_type, exam_year, problem_number);

-- Tenant isolation
CREATE INDEX idx_problems_tenant ON problems(tenant_id);

-- Full-text search
CREATE INDEX idx_problems_search ON problems USING GIN(to_tsvector('english', content));
```

#### 2. Composite Indexes
```sql
-- Difficulty-based filtering
CREATE INDEX idx_problems_difficulty ON problems(subject, difficulty);

-- Year and category filtering
CREATE INDEX idx_problems_year_category ON problems(exam_year, category);
```

#### 3. Tag-based Indexing
```sql
-- GIN index for array operations on tags
CREATE INDEX idx_problems_tags ON problems USING GIN(tags);
```

### Query Optimization Examples

```sql
-- Find specific problem
SELECT * FROM problems
WHERE exam_type = 'AMC10'
  AND exam_year = 2024
  AND problem_number = 5
  AND tenant_id = ?;

-- Search by topic tags
SELECT * FROM problems
WHERE tags @> ARRAY['geometry', '2024']
  AND tenant_id = ?;

-- Full-text search
SELECT * FROM problems
WHERE to_tsvector('english', content) @@ plainto_tsquery('triangle area')
  AND tenant_id = ?;

-- Difficulty-filtered retrieval
SELECT * FROM problems
WHERE difficulty = 'medium'
  AND subject = 'Mathematics'
  AND tenant_id = ?
ORDER BY exam_year DESC, problem_number ASC;
```

## Usage

### 1. Quick Test (Single Problem)
```bash
npm run scrape-amc:demo -- --quick
```

### 2. Test Scraping (Few Problems)
```bash
# Scrape first 5 problems from 2024 AMC 10A
npm run scrape-amc:test -- --year 2024 --test A --count 5

# Scrape 10 problems from 2023 AMC 10B
npm run scrape-amc -- --year 2023 --test B --count 10
```

### 3. Full Scraping (All Problems)
```bash
# Scrape all AMC 10 problems (2020+)
npm run scrape-amc:full

# With custom tenant
npm run scrape-amc -- --full-scrape --tenant my-school
```

### 4. Connection Test
```bash
npm run scrape-amc:test -- --test-connection
```

## Data Conversion Flow

```
AoPS Problem Page
       ↓
[Web Scraping]
       ↓
AMCProblem Interface
  - year, test, problemNumber
  - content, solutions, choices
  - topics, difficulty, seeAlso, images
       ↓
[convertToSbuddyProblem]
       ↓
Sbuddy Problem Format
  - title, content, source
  - category, difficulty, subject
  - exam_type, exam_year, problem_number
  - tags, solution, tenant_id
       ↓
[bulkImportProblems]
       ↓
PostgreSQL Database
```

## Best Practices

### 1. Scraping Ethics
- ✅ Respect rate limits (1s between tests)
- ✅ Handle errors gracefully
- ✅ Cache results when possible
- ✅ Include user-agent identification
- ❌ Don't overwhelm the server
- ❌ Don't scrape more than needed

### 2. Data Quality
- Validate LaTeX formatting before storage
- Check for complete problem extraction
- Verify solution presence
- Ensure proper metadata assignment
- Log missing or incomplete data

### 3. Maintenance
- Periodically update for new test years
- Monitor for AoPS site structure changes
- Update selectors if DOM structure changes
- Archive raw scraped data for re-processing

## Future Enhancements

### 1. Image Handling
- [ ] Download and store images locally/S3
- [ ] OCR for diagram analysis
- [ ] Image compression and optimization

### 2. Enhanced Metadata
- [ ] Extract author/contributor information
- [ ] Parse video solution timestamps
- [ ] Extract difficulty ratings if available
- [ ] Topic classification via NLP

### 3. Multi-Competition Support
- [ ] AMC 8 scraper
- [ ] AMC 12 scraper
- [ ] AIME scraper
- [ ] USAMO scraper
- [ ] International competitions (IMO, etc.)

### 4. Real-time Updates
- [ ] Monitor for new problem releases
- [ ] Webhook-based updates
- [ ] Automated scraping schedule

### 5. Advanced Indexing
- [ ] Semantic search with embeddings
- [ ] Similar problem detection
- [ ] Topic-based clustering
- [ ] Difficulty calibration via user data

## Troubleshooting

### Common Issues

**Problem: No content extracted**
- Check if page structure changed
- Verify selectors in `extractProblemContent()`
- Try alternative selectors

**Problem: LaTeX not rendering**
- Ensure delimiters are preserved
- Check `preserveLaTeX()` method
- Verify frontend LaTeX renderer

**Problem: Rate limiting / 429 errors**
- Increase delay values
- Implement exponential backoff
- Check IP-based throttling

**Problem: Duplicate problems in database**
- Check unique constraints
- Verify `bulkImportProblems()` logic
- Review tenant_id assignment

## Technical Specifications

### Dependencies
- `axios`: HTTP requests
- `cheerio`: HTML parsing
- `pg`: PostgreSQL client

### Environment Variables
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/sbuddy
```

### Performance Metrics
- Average scraping time: ~30s per test (25 problems)
- Full scrape (2020-2025, ~10 tests): ~5-10 minutes
- Database insertion: ~50 problems/second (batch mode)

## Conclusion

The AoPS scraping system provides a robust, ethical, and efficient way to populate Sbuddy with high-quality competition math problems. The indexing strategy ensures fast retrieval and supports the platform's core features: problem identification, spaced repetition, and study planning.
