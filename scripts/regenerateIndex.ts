import fs from 'fs';
import path from 'path';

/**
 * Regenerate amc_index.json from existing crawled files
 */

const crawledDir = 'crawled_data';
const outputFile = path.join(crawledDir, 'amc_index.json');

// Get all AMC problem files
const files = fs.readdirSync(crawledDir)
  .filter(f => f.match(/^amc_\d{4}_10[ab]_problems\.json$/))
  .sort();

console.log(`Found ${files.length} test files`);

const tests = files.map(filename => {
  const filePath = path.join(crawledDir, filename);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  return {
    year: data.metadata.year,
    variant: data.metadata.test.includes('10A') ? 'A' : 'B',
    test: data.metadata.test,
    problemCount: data.metadata.totalProblems,
    filePath: `crawled_data/${filename}`,
    source: data.metadata.source
  };
});

const indexData = {
  generatedAt: new Date().toISOString(),
  totalTests: tests.length,
  successfulTests: tests.length,
  failedTests: 0,
  tests: tests
};

fs.writeFileSync(outputFile, JSON.stringify(indexData, null, 2));

console.log(`\n✅ Generated index with ${tests.length} tests`);
console.log(`📑 Saved to: ${outputFile}`);

tests.forEach(t => {
  console.log(`   - ${t.year} ${t.test}: ${t.problemCount} problems`);
});
