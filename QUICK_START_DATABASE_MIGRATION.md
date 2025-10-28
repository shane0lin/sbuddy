# Quick Start: Database Migration for Crawler & Viewer

## TL;DR - What Changed?

✅ Crawled AMC problems now save to **PostgreSQL database** (primary) + JSON files (backup)
✅ Viewer now fetches data from **REST API** with automatic fallback to files
✅ New API endpoints at `/api/v1/crawled/*` for accessing problems
✅ Fully backward compatible - existing workflows still work

## Quick Commands

### 1. Import Existing Data (One-Time Setup)
```bash
# Import all 650 problems from JSON files to database
npm run import:crawled
```

### 2. Start the Server
```bash
# Development mode
npm run dev

# Production
npm run build && npm run start
```

### 3. Access the Viewer
Open browser: `http://localhost:3000/viewer/index.html`

The viewer will automatically use the API if available, or fall back to JSON files.

### 4. Crawl New Data
```bash
# Single test
npm run crawl:2012-amc10a

# All AMC 10 tests (2012-2024)
npm run crawl:all-amc10
```

New crawls automatically save to both database and JSON files.

## API Endpoints

### Get all available tests
```bash
curl http://localhost:3000/api/v1/crawled/tests
```

### Get problems for a specific test
```bash
# 2012 AMC 10A
curl http://localhost:3000/api/v1/crawled/tests/2012/A

# 2024 AMC 10B
curl http://localhost:3000/api/v1/crawled/tests/2024/B
```

### Get problem index (like amc_index.json)
```bash
curl http://localhost:3000/api/v1/crawled/index
```

### Search problems
```bash
curl "http://localhost:3000/api/v1/crawled/search?q=triangle&difficulty=easy"
```

### Get single problem by ID
```bash
curl http://localhost:3000/api/v1/crawled/problems/{uuid}
```

## Verify Everything Works

1. **Check TypeScript compilation**:
   ```bash
   npm run typecheck
   ```

2. **Import existing data**:
   ```bash
   npm run import:crawled
   ```
   Should show: ~650 problems imported from 26 tests

3. **Start server and test API**:
   ```bash
   npm run dev
   # In another terminal:
   curl http://localhost:3000/api/v1/crawled/tests
   ```

4. **Test viewer**:
   - Open `http://localhost:3000/viewer/index.html`
   - Check browser console - should see "AMC Data Adapter initialized in API mode"
   - Problems should load and display

## Architecture Overview

```
Crawler → Database (Primary) + JSON (Backup)
              ↓
         API Layer (/api/v1/crawled)
              ↓
         Viewer (Auto-detects API/File mode)
```

## Troubleshooting

### Viewer shows "Error loading tests"
- Check server is running: `npm run dev`
- Check API endpoint: `curl http://localhost:3000/api/v1/crawled/tests`
- Check browser console for errors

### Import script fails
- Ensure database is initialized
- Check DATABASE_URL in .env
- Verify JSON files exist in `crawled_data/`

### API returns empty results
- Run import script: `npm run import:crawled`
- Check database has data:
  ```sql
  SELECT COUNT(*) FROM problems WHERE crawled_at IS NOT NULL;
  ```

### Viewer uses file mode instead of API
- Verify server is running
- Check CORS settings in server
- Check browser console for API errors
- File mode is fine - it's the fallback!

## Files You Can Ignore

✅ JSON files in `crawled_data/` - Still used as backup and fallback
✅ Old viewer code - Updated to use API adapter
✅ Migration SQL - Already applied to database schema

## Next Steps

- Import existing data: `npm run import:crawled`
- Start server: `npm run dev`
- Open viewer: `http://localhost:3000/viewer/index.html`
- Optionally crawl fresh data: `npm run crawl:all-amc10`

## Documentation

- Full plan: `docs/CRAWLER_DATABASE_MIGRATION_PLAN.md`
- Completion summary: `docs/CRAWLER_DATABASE_MIGRATION_COMPLETE.md`
- Project overview: `CLAUDE.md`

---

**You're all set! The migration is complete and ready to use.** 🚀
