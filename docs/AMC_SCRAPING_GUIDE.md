# AMC 10 Problems Scraping Guide

This guide explains how to scrape AMC 10 problems from Art of Problem Solving (AoPS) and import them into the Sbuddy database.

## 🎯 Overview

The Sbuddy system includes comprehensive web scraping capabilities to crawl AMC 10 problems from the Art of Problem Solving wiki. The scraper:

- ✅ Extracts problem statements and multiple solutions
- ✅ Handles multiple problems per page detection
- ✅ Converts to Sbuddy database format
- ✅ Supports bulk import with rate limiting
- ✅ Includes comprehensive error handling
- ✅ Respects server resources with delays

## 🚀 Quick Start

### Demo Mode (No Database Required)
```bash
# Quick test - scrapes 1 problem
npm run scrape-amc:quick

# Full demo - scrapes 5 problems, saves to JSON
npm run scrape-amc:demo
```

### Database Import Mode
```bash
# Test connection to AoPS
npm run scrape-amc:test

# Scrape specific test
npm run scrape-amc -- --year 2024 --test A --count 10

# Full scrape (all problems from 2020+)
npm run scrape-amc:full
```

## 📋 Prerequisites

### For Demo Mode
- Node.js 18+
- Internet connection

### For Database Import
- PostgreSQL running and accessible
- Redis running and accessible
- Configured `.env` file

## 🛠️ Setup Instructions

### 1. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env file
DATABASE_URL=postgresql://username:password@localhost:5432/sbuddy_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key
```

### 2. Database Setup
```bash
# Start PostgreSQL and Redis
# Ubuntu/Debian:
sudo systemctl start postgresql redis-server

# macOS:
brew services start postgresql redis

# Docker:
docker-compose up -d postgres redis
```

### 3. Install Dependencies
```bash
npm install
```

## 📚 Usage Examples

### Demo Scraping (Recommended First Step)
```bash
# Test connection
npm run scrape-amc:quick

# Run full demo
npm run scrape-amc:demo
```

**Output:**
```
🔍 AMC 10 Demo Scraper - No Database Required
==================================================

1. Testing connection to Art of Problem Solving...
✅ Connection successful!

2. Scraping sample AMC 10 problems...
✅ Successfully scraped 5 problems

3. Sample Problems:
📚 Problem 1:
Year: 2024
Test: AMC 10A
Problem #: 1
Content: What is the value of...
Solutions Found: 23
```

### Database Import
```bash
# Import specific problems
npm run scrape-amc -- --year 2024 --test A --count 5 --tenant my-school

# Import multiple years
npm run scrape-amc -- --year 2023 --test B --count 25

# Full import (careful - this takes time!)
npm run scrape-amc:full
```

## 🔧 Command Line Options

### General Options
- `--help` - Show help information
- `--test-connection` - Test connection to AoPS
- `--full-scrape` - Scrape all available problems

### Specific Scraping Options
- `--year YYYY` - Target specific year (e.g., 2024)
- `--test A|B` - Target specific test version
- `--count N` - Number of problems to scrape
- `--tenant NAME` - Tenant name for multi-tenancy

### Examples
```bash
# Test connection
npm run scrape-amc -- --test-connection

# Scrape 2023 AMC 10B, first 10 problems
npm run scrape-amc -- --year 2023 --test B --count 10

# Full scrape with custom tenant
npm run scrape-amc -- --full-scrape --tenant university-math-dept
```

## 📊 Data Structure

### Problem Format
Each scraped problem includes:

```json
{
  "year": 2024,
  "test": "A",
  "problemNumber": 1,
  "content": "What is the value of...",
  "solutions": [
    "The likely fastest method...",
    "We have...",
    "Note that..."
  ],
  "choices": ["(A) 0", "(B) 2", "(C) 100", "(D) 200", "(E) 202"]
}
```

### Sbuddy Database Format
Problems are converted to:

```json
{
  "title": "2024 AMC 10A Problem 1",
  "content": "What is the value of...\n\nAnswer choices:\n(A) 0\n(B) 2...",
  "source": "Art of Problem Solving",
  "category": "Competition",
  "difficulty": "medium",
  "subject": "Mathematics",
  "exam_type": "AMC10",
  "exam_year": 2024,
  "problem_number": 1,
  "tags": ["AMC10A", "2024", "competition", "mathematics"],
  "solution": "The likely fastest method...",
  "tenant_id": "uuid"
}
```

## 🚦 Rate Limiting & Ethics

The scraper includes built-in rate limiting:
- 1 second delay between test pages
- 200ms delay between individual problems
- Respectful request patterns
- Error handling for server issues

**Important:** Please be respectful when scraping:
- Don't run multiple concurrent scrapers
- Use demo mode for testing
- Consider using `--count` to limit requests
- The full scraper only targets 2020+ years by default

## 🐛 Troubleshooting

### Common Issues

**1. Database Connection Errors**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution:** Ensure PostgreSQL is running and `.env` DATABASE_URL is correct

**2. Redis Connection Errors**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solution:** Ensure Redis is running and `.env` REDIS_URL is correct

**3. Network/Scraping Errors**
```
Error: Request failed with status code 404
```
**Solution:** Problem may not exist, or AoPS structure changed

**4. TypeScript Compilation Errors**
```
TSError: Unable to compile TypeScript
```
**Solution:** Run `npm run typecheck` to see specific issues

### Debug Mode
```bash
# Enable debug logging
DEBUG=scraper npm run scrape-amc:demo

# Verbose output
npm run scrape-amc -- --year 2024 --test A --count 1 --verbose
```

## 📈 Performance

### Expected Performance
- **Single Problem:** ~2-3 seconds
- **10 Problems:** ~30-45 seconds
- **Full Test (25 problems):** ~2-3 minutes
- **Full Scrape (all years):** ~20-30 minutes

### Scaling Considerations
- Memory usage: ~50MB for 100 problems
- Database: ~1KB per problem (varies with solution length)
- Network: ~10KB per problem page

## 🔍 Advanced Usage

### Custom Scraping
```javascript
import aopsScraper from './src/services/aopsScraper';

// Scrape specific problems
const problems = await aopsScraper.scrapeSpecificTest(2024, 'A', 5);

// Convert to Sbuddy format
const sbuddyProblems = problems.map(p =>
  aopsScraper.convertToSbuddyProblem(p, tenantId)
);

// Import to database
import problemRepository from './src/services/problemRepository';
await problemRepository.bulkImportProblems(sbuddyProblems);
```

### Integration with Sbuddy Features
Once problems are imported, they work with all Sbuddy features:
- 🔍 AI-powered problem matching
- 📚 Spaced repetition learning
- 🎮 Gamification and scoring
- 🏆 Achievement system
- 📊 Progress tracking

## 📄 License & Attribution

**Important Legal Notes:**
- AMC problems are copyrighted by the Mathematical Association of America
- This scraper is for educational/personal use
- Problems are attributed to "Art of Problem Solving" in the database
- Respect AoPS terms of service
- Consider supporting both AoPS and MAA

## 🤝 Contributing

To improve the scraper:
1. Test with `npm run scrape-amc:demo` first
2. Make changes to `src/services/aopsScraper.ts`
3. Test with different years/problems
4. Submit PR with test results

## 🆘 Support

If you encounter issues:
1. Check this troubleshooting guide
2. Run demo mode to isolate database vs. scraping issues
3. Check AoPS website hasn't changed structure
4. Report issues with specific error messages and command used