# Crawler & Viewer Database Migration Plan

**Status**: In Progress
**Created**: 2025-10-22
**Last Updated**: 2025-10-22

## Overview

Migrate crawler and viewer system from file-based storage (JSON files) to PostgreSQL database storage for better integration with the existing Sbuddy platform.

## Current State Analysis

### Crawlers
- Save data to JSON files in `crawled_data/` directory
- Currently crawled: 26 AMC 10 tests (2012-2024, A & B variants) = 650 problems
- Scripts: `crawl2012AMC10A.ts`, `crawlAllAMC10.ts`, etc.

### Data Structure
Each problem includes:
- **Basic fields**: year, test, problemNumber, content, difficulty, topics
- **Rich metadata**:
  - solutions[] - multiple solution approaches
  - images[] - problem diagrams/figures
  - answerChoicesImage - rendered answer choices
  - seeAlso[] - related problems/references
  - choices[] - answer choice data

### Database
- Has `problems` table with basic fields
- Missing crawler-specific fields (images, multiple solutions, etc.)

### Viewer
- Static HTML files in `public/viewer/`
- Reads from local JSON files via fetch API
- Features: problem browser, study plans, test viewer

## Migration Tasks

### 1. Extend Database Schema
Add new fields to `problems` table:
- `solutions` (JSONB) - array of solution texts
- `images` (TEXT[]) - array of image URLs
- `answer_choices_image` (TEXT) - answer choices image URL
- `see_also` (TEXT[]) - related references
- `choices` (JSONB) - answer choices data
- `crawl_source_url` (TEXT) - original AoPS URL
- `crawled_at` (TIMESTAMP) - when it was crawled
- Add indexes for efficient querying

### 2. Create Database Migration Script
- Write SQL migration to add new columns
- Ensure backward compatibility
- Add proper indexes
- Update `src/models/database.ts`

### 3. Create Data Import Service
- Build service to transform JSON problem format → database Problem type
- Handle data validation and cleaning
- Support bulk imports with transactions
- Map fields correctly (test variant, problem metadata, etc.)
- Handle duplicate detection (by year/test/problem_number)

### 4. Update Crawler Scripts
- Modify crawl scripts to use import service
- Keep JSON file export as backup (optional)
- Add database save after successful crawl
- Handle duplicate detection/updates

### 5. Create API Endpoints
- `GET /api/v1/problems/tests` - list all available tests
- `GET /api/v1/problems/tests/:year/:variant` - get all problems for a test
- `GET /api/v1/problems/:id` - get single problem with full metadata
- Update existing `problemController.ts` to return new fields

### 6. Update Viewer
- Modify viewer HTML files to fetch from API endpoints
- Update JavaScript to handle API responses
- Add loading states and error handling
- Keep viewer as static files, just change data source

### 7. Data Migration Script
- Script to import all existing JSON files (650 problems)
- Read from `crawled_data/` directory
- Bulk import into database
- Verify data integrity
- Generate migration report

### 8. Testing
- Test complete flow: crawl → save to DB → API serves → viewer displays
- Verify data integrity
- Test with sample from each year
- Ensure backward compatibility with existing problem repository features

## Benefits

- **Centralized Storage**: Single source of truth in database
- **Leverage Existing Features**: Auth, multi-tenancy, full-text search
- **Enable SRS**: Support spaced repetition for AMC problems
- **API-Driven**: Better architecture for future mobile apps
- **Data Integrity**: Database constraints and transactions
- **Scalability**: Better performance than file-based storage

## Technical Considerations

### Tenant Handling
- Use default/system tenant for crawled public AMC problems
- Or create a special "public" tenant for shared content
- Allow copying to user-specific tenants if needed

### Storage Considerations
- 650 problems with rich metadata (images, multiple solutions)
- JSONB fields for flexible nested data
- Proper indexing to maintain query performance

### Backward Compatibility
- Keep existing `problemRepository` API intact
- Extend with new fields rather than breaking changes
- Existing features should continue to work

### Data Integrity
- Keep JSON files as backup/archive
- Add unique constraint on (exam_type, exam_year, problem_number, tenant_id)
- Validate data during import

### API Access
- Consider rate limiting for public access
- May need authentication for viewer if deployed publicly
- Or create read-only public endpoints for crawled data

## Implementation Order

1. ✅ Plan created and saved
2. Schema extension and migration
3. Data import service
4. Migration script for existing data
5. API endpoints
6. Update crawler scripts
7. Update viewer
8. Testing and validation

## Success Criteria

- [ ] All 650 existing problems imported to database
- [ ] New crawls save directly to database
- [ ] Viewer loads data from API successfully
- [ ] No data loss or corruption
- [ ] Existing problem repository features still work
- [ ] Performance is acceptable (queries < 500ms)
- [ ] Full test coverage for new services

## Rollback Plan

- Keep JSON files as backup
- Database migration can be rolled back via SQL
- Viewer can be reverted to file-based if needed
- Git version control for all code changes
