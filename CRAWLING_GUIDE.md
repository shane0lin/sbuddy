# AMC Problems Crawling Guide

## Quick Start

### Crawl 2012 AMC 10A (Example)

```bash
npm run crawl:2012-amc10a
```

**Output**:
- `crawled_data/amc_2012_10a_problems.json` (formatted)
- `crawled_data/amc_2012_10a_problems_compact.json` (compact)

### View Results

```bash
# View all problems summary
npm run view:crawled -- crawled_data/amc_2012_10a_problems.json

# View specific problem
npm run view:crawled -- crawled_data/amc_2012_10a_problems.json --problem 5
```

## Available Commands

| Command | Description | Database Required |
|---------|-------------|-------------------|
| `npm run scrape-amc:demo -- --quick` | Test crawler (1 problem) | ❌ No |
| `npm run scrape-amc:demo` | Demo scraper (5 problems) | ❌ No |
| `npm run scrape-amc -- --year 2024 --test A --count 10` | Scrape & save to DB | ✅ Yes |
| `npm run crawl:2012-amc10a` | Crawl 2012 AMC 10A to file | ❌ No |
| `npm run view:crawled -- <file>` | View crawled data | ❌ No |

## Crawling Workflows

### Workflow 1: Quick Test (No Database)

**Best for**: Testing if the crawler works, exploring the data structure

```bash
# 1. Quick test (1 problem)
npm run scrape-amc:demo -- --quick

# 2. Demo mode (5 problems, saves to scraped_problems.json)
npm run scrape-amc:demo

# 3. View the results
cat scraped_problems.json | jq '.[0]'
```

**Output**: `scraped_problems.json` in project root

### Workflow 2: Crawl to File (No Database)

**Best for**: Archiving data, bulk collection, offline analysis

```bash
# 1. Crawl specific year/test
npm run crawl:2012-amc10a

# 2. View results
npm run view:crawled -- crawled_data/amc_2012_10a_problems.json

# 3. View specific problem
npm run view:crawled -- crawled_data/amc_2012_10a_problems.json --problem 10
```

**Output**: Structured JSON files in `crawled_data/` directory

### Workflow 3: Import to Database

**Best for**: Production use, enabling search/study features

```bash
# 1. Ensure PostgreSQL is running
# 2. Set DATABASE_URL in .env

# 3. Scrape and import
npm run scrape-amc -- --year 2024 --test A --count 25

# 4. Verify import
# (Use your database client to check the problems table)
```

**Output**: Problems stored in PostgreSQL database

## Creating Custom Crawlers

### Example: Crawl a Different Year

1. **Copy the template**:
   ```bash
   cp scripts/crawl2012AMC10A.ts scripts/crawl2023AMC10B.ts
   ```

2. **Edit the script**:
   ```typescript
   // Change these values
   const year = 2023;
   const test = 'B';
   const outputFile = 'amc_2023_10b_problems.json';

   // In the crawl() method:
   const problems = await aopsScraper.scrapeSpecificTest(year, test, 25);
   ```

3. **Add npm script** (package.json):
   ```json
   {
     "crawl:2023-amc10b": "ts-node scripts/crawl2023AMC10B.ts"
   }
   ```

4. **Run it**:
   ```bash
   npm run crawl:2023-amc10b
   ```

### Example: Crawl Multiple Years

```typescript
// scripts/crawlMultipleYears.ts
import aopsScraper from '../src/services/aopsScraper';
import fs from 'fs';

const years = [2020, 2021, 2022, 2023, 2024];
const tests = ['A', 'B'];

for (const year of years) {
  for (const test of tests) {
    console.log(`Crawling ${year} AMC 10${test}...`);

    const problems = await aopsScraper.scrapeSpecificTest(
      year,
      test as 'A' | 'B',
      25
    );

    const filename = `crawled_data/amc_${year}_10${test.toLowerCase()}_problems.json`;
    fs.writeFileSync(filename, JSON.stringify({
      metadata: { year, test, totalProblems: problems.length },
      problems
    }, null, 2));

    console.log(`✓ Saved to ${filename}`);

    // Wait 5 seconds between tests (be respectful)
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
```

## Data Format Reference

### Output Structure

```json
{
  "metadata": {
    "crawledAt": "2025-10-19T23:16:47.195Z",
    "source": "https://artofproblemsolving.com/wiki/index.php/2012_AMC_10A_Problems",
    "year": 2012,
    "test": "AMC 10A",
    "totalProblems": 25
  },
  "problems": [
    {
      "year": 2012,
      "test": "A",
      "problemNumber": 1,
      "content": "Problem statement...",
      "solutions": ["Solution 1...", "Solution 2..."],
      "choices": [],
      "topics": ["Category"],
      "difficulty": "easy",
      "seeAlso": ["Related problems..."],
      "images": ["https://..."]
    }
  ]
}
```

### Field Descriptions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `year` | number | Competition year | `2012` |
| `test` | string | Test version | `"A"` or `"B"` |
| `problemNumber` | number | Problem number (1-25) | `5` |
| `content` | string | Full problem text | `"Cagney can frost..."` |
| `solutions` | string[] | Solution approaches | `["Solution 1...", "Solution 2..."]` |
| `choices` | string[] | Answer choices | `["(A) 15", "(B) 20", ...]` |
| `topics` | string[] | Math topics | `["Geometry", "Algebra"]` |
| `difficulty` | string | `"easy"`, `"medium"`, or `"hard"` | `"easy"` |
| `seeAlso` | string[] | Related problems | `["2012 AMC 10A Problem 2"]` |
| `images` | string[] | Image URLs | `["https://artofproblemsolving.com/..."]` |

## Processing Crawled Data

### Convert to Sbuddy Format

```typescript
import aopsScraper from './src/services/aopsScraper';
import fs from 'fs';

const data = JSON.parse(
  fs.readFileSync('crawled_data/amc_2012_10a_problems.json', 'utf-8')
);

const tenantId = 'your-tenant-id';

const sbuddyProblems = data.problems.map(p =>
  aopsScraper.convertToSbuddyProblem(p, tenantId)
);

console.log(sbuddyProblems[0]);
// {
//   title: "2012 AMC 10A Problem 1",
//   content: "...",
//   difficulty: "easy",
//   exam_type: "AMC10",
//   tags: ["AMC10A", "2012", "competition"],
//   ...
// }
```

### Filter by Difficulty

```typescript
const data = JSON.parse(fs.readFileSync('crawled_data/amc_2012_10a_problems.json'));

// Get only hard problems
const hardProblems = data.problems.filter(p => p.difficulty === 'hard');

console.log(`Found ${hardProblems.length} hard problems`);
// Output: Found 5 hard problems
```

### Extract Topics

```typescript
const data = JSON.parse(fs.readFileSync('crawled_data/amc_2012_10a_problems.json'));

const allTopics = new Set();
data.problems.forEach(p => {
  p.topics?.forEach(topic => allTopics.add(topic));
});

console.log('All topics:', Array.from(allTopics));
```

### Generate Study Set

```typescript
// Get 5 easy, 10 medium, 5 hard problems
const easy = data.problems.filter(p => p.difficulty === 'easy').slice(0, 5);
const medium = data.problems.filter(p => p.difficulty === 'medium').slice(0, 10);
const hard = data.problems.filter(p => p.difficulty === 'hard').slice(0, 5);

const studySet = [...easy, ...medium, ...hard];

fs.writeFileSync('my_study_set.json', JSON.stringify(studySet, null, 2));
```

## Best Practices

### 1. Rate Limiting

**Always** respect the source server:

```typescript
// Built-in delays (in aopsScraper.ts)
- 1000ms between test pages
- 500ms between individual problems
```

For bulk crawling, add additional delays:
```typescript
await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
```

### 2. Error Handling

```typescript
try {
  const problems = await aopsScraper.scrapeSpecificTest(year, test, 25);
  console.log(`✓ Crawled ${problems.length} problems`);
} catch (error) {
  console.error(`❌ Crawl failed:`, error.message);
  // Continue with next test or save partial data
}
```

### 3. Backup Crawled Data

```bash
# Create backup directory
mkdir -p crawled_data/backups

# Backup with timestamp
cp crawled_data/amc_2012_10a_problems.json \
   crawled_data/backups/amc_2012_10a_problems_$(date +%Y%m%d).json
```

### 4. Verify Data Integrity

```typescript
// Check if all 25 problems were crawled
const data = JSON.parse(fs.readFileSync('crawled_data/amc_2012_10a_problems.json'));

if (data.problems.length !== 25) {
  console.warn(`⚠️  Expected 25 problems, got ${data.problems.length}`);
}

// Check for missing solutions
const noSolutions = data.problems.filter(p => !p.solutions || p.solutions.length === 0);
if (noSolutions.length > 0) {
  console.warn(`⚠️  ${noSolutions.length} problems missing solutions`);
}
```

## Troubleshooting

### Problem: Crawler hangs or times out

**Solution**: Increase timeout in scraper
```typescript
// In aopsScraper.ts, increase delay
private readonly delay = 2000; // Increase from 1000ms to 2000ms
```

### Problem: Some problems not found (404)

**Normal**: Not all years have all 25 problems published
**Solution**: Crawler handles this gracefully, skips missing problems

### Problem: JSON file too large

**Solution**: Use compact format
```typescript
// Save without formatting
fs.writeFileSync('output.json', JSON.stringify(data));
```

Or compress:
```bash
gzip crawled_data/amc_2012_10a_problems.json
```

### Problem: LaTeX not rendering properly

**Solution**: Use the `preserveLaTeX()` method (already implemented)
```typescript
private preserveLaTeX($: cheerio.Root, selector: string): string {
  // Keeps LaTeX delimiters intact
}
```

## Advanced Use Cases

### 1. Build Complete AMC 10 Archive

```bash
# Crawl all years from 2000-2024
for year in {2000..2024}; do
  for test in A B; do
    npm run crawl:amc10 -- --year $year --test $test
    sleep 10
  done
done
```

### 2. Create Difficulty-Calibrated Study Plans

```typescript
// Mix problems from different years, same difficulty
const allEasy = [];
const years = [2020, 2021, 2022, 2023, 2024];

years.forEach(year => {
  const data = JSON.parse(fs.readFileSync(`crawled_data/amc_${year}_10a_problems.json`));
  const easy = data.problems.filter(p => p.difficulty === 'easy');
  allEasy.push(...easy);
});

// Shuffle and select 10 random easy problems
const shuffled = allEasy.sort(() => Math.random() - 0.5);
const studySet = shuffled.slice(0, 10);
```

### 3. Export to CSV

```typescript
import { createArrayCsvWriter } from 'csv-writer';

const data = JSON.parse(fs.readFileSync('crawled_data/amc_2012_10a_problems.json'));

const csvWriter = createArrayCsvWriter({
  path: 'problems.csv',
  header: ['Year', 'Test', 'Number', 'Difficulty', 'Content']
});

const records = data.problems.map(p => [
  p.year,
  p.test,
  p.problemNumber,
  p.difficulty,
  p.content.substring(0, 100) + '...'
]);

await csvWriter.writeRecords(records);
```

## Resources

- **AoPS Wiki**: https://artofproblemsolving.com/wiki/index.php/AMC_10_Problems_and_Solutions
- **Scraping Strategy**: `docs/SCRAPING_STRATEGY.md`
- **Query Examples**: `docs/QUERY_EXAMPLES.md`
- **Crawl Summary**: `docs/CRAWL_2012_AMC10A_SUMMARY.md`

## License & Copyright

Problems are copyrighted © by the Mathematical Association of America (MAA). Use for educational purposes only.

---

**Last Updated**: October 19, 2025
**Version**: 1.0
