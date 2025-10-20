import fs from 'fs';
import path from 'path';

/**
 * View crawled data in a readable format
 */
class DataViewer {
  viewFile(filePath: string, options: { problemNumber?: number } = {}): void {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    console.log('='.repeat(70));
    console.log('📄 CRAWLED DATA VIEWER');
    console.log('='.repeat(70));

    // Display metadata
    console.log('\n📊 METADATA:');
    console.log(`  Source: ${data.metadata.source}`);
    console.log(`  Year: ${data.metadata.year}`);
    console.log(`  Test: ${data.metadata.test}`);
    console.log(`  Total Problems: ${data.metadata.totalProblems}`);
    console.log(`  Crawled At: ${new Date(data.metadata.crawledAt).toLocaleString()}`);

    if (options.problemNumber) {
      // Display specific problem
      const problem = data.problems.find((p: any) => p.problemNumber === options.problemNumber);
      if (problem) {
        this.displayProblem(problem);
      } else {
        console.log(`\n❌ Problem ${options.problemNumber} not found`);
      }
    } else {
      // Display all problems summary
      console.log('\n' + '='.repeat(70));
      console.log('📚 ALL PROBLEMS:');
      console.log('='.repeat(70));

      data.problems.forEach((problem: any, index: number) => {
        console.log(`\n${index + 1}. Problem ${problem.problemNumber} [${problem.difficulty}]`);
        console.log(`   ${problem.content.substring(0, 100)}...`);
        console.log(`   Solutions: ${problem.solutions?.length || 0} | Images: ${problem.images?.length || 0}`);
      });
    }

    console.log('\n' + '='.repeat(70));
  }

  private displayProblem(problem: any): void {
    console.log('\n' + '='.repeat(70));
    console.log(`📝 PROBLEM ${problem.problemNumber}`);
    console.log('='.repeat(70));

    console.log(`\nYear: ${problem.year}`);
    console.log(`Test: ${problem.test}`);
    console.log(`Difficulty: ${problem.difficulty}`);
    console.log(`\nProblem Statement:`);
    console.log(problem.content);

    if (problem.choices && problem.choices.length > 0) {
      console.log(`\nAnswer Choices:`);
      problem.choices.forEach((choice: string) => {
        console.log(`  ${choice}`);
      });
    }

    console.log(`\nSolutions (${problem.solutions?.length || 0} available):`);
    if (problem.solutions && problem.solutions.length > 0) {
      console.log('\nFirst Solution:');
      console.log(problem.solutions[0].substring(0, 500) + '...');
    }

    if (problem.topics && problem.topics.length > 0) {
      console.log(`\nTopics: ${problem.topics.join(', ')}`);
    }

    if (problem.images && problem.images.length > 0) {
      console.log(`\nImages: ${problem.images.length} found`);
    }

    console.log('\n' + '='.repeat(70));
  }
}

// CLI
const main = () => {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.length === 0) {
    console.log(`
Data Viewer - View crawled AMC problem data

Usage:
  npm run view:crawled -- <file> [options]

Options:
  --problem N    View specific problem number
  --help         Show this help

Examples:
  # View all problems summary
  npm run view:crawled -- crawled_data/amc_2012_10a_problems.json

  # View specific problem
  npm run view:crawled -- crawled_data/amc_2012_10a_problems.json --problem 5
    `);
    return;
  }

  const filePath = args[0];
  const problemNumber = args.includes('--problem')
    ? parseInt(args[args.indexOf('--problem') + 1])
    : undefined;

  const viewer = new DataViewer();
  viewer.viewFile(filePath, { problemNumber });
};

if (require.main === module) {
  main();
}

export default DataViewer;
