import aopsScraper from '../src/services/aopsScraper';
import fs from 'fs';
import path from 'path';

/**
 * Crawl 2013 AMC 10B Problems
 */
class AMC2013B_Crawler {
  private outputDir = 'crawled_data';
  private outputFile = 'amc_2013_10b_problems.json';

  async crawl(): Promise<void> {
    console.log('🔍 Starting crawl of 2013 AMC 10B Problems');
    console.log('URL: https://artofproblemsolving.com/wiki/index.php/2013_AMC_10B_Problems');
    console.log('='.repeat(70));

    try {
      // Ensure output directory exists
      this.ensureOutputDirectory();

      // Crawl all 25 problems from 2013 AMC 10B
      console.log('\n📚 Crawling all 25 problems from 2013 AMC 10B...\n');
      const problems = await aopsScraper.scrapeSpecificTest(2013, 'B', 25);

      console.log(`\n✅ Successfully crawled ${problems.length} problems`);

      // Save to file
      const outputPath = path.join(this.outputDir, this.outputFile);
      this.saveToFile(problems, outputPath);

      // Display summary
      this.displaySummary(problems, outputPath);

    } catch (error) {
      console.error('❌ Crawl failed:', error);
      throw error;
    }
  }

  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      console.log(`✓ Created output directory: ${this.outputDir}`);
    }
  }

  private saveToFile(problems: any[], filePath: string): void {
    const data = {
      metadata: {
        crawledAt: new Date().toISOString(),
        source: 'https://artofproblemsolving.com/wiki/index.php/2013_AMC_10B_Problems',
        year: 2013,
        test: 'AMC 10B',
        totalProblems: problems.length
      },
      problems: problems
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`\n💾 Results saved to: ${filePath}`);
  }

  private displaySummary(problems: any[], outputPath: string): void {
    console.log('\n' + '='.repeat(70));
    console.log('📊 CRAWL SUMMARY');
    console.log('='.repeat(70));

    console.log(`\nTotal Problems Crawled: ${problems.length}`);

    // Count by difficulty
    const difficultyCount = problems.reduce((acc: any, p: any) => {
      acc[p.difficulty] = (acc[p.difficulty] || 0) + 1;
      return acc;
    }, {});

    console.log('\nDifficulty Distribution:');
    Object.entries(difficultyCount).forEach(([diff, count]) => {
      console.log(`  ${diff}: ${count} problems`);
    });

    // Count problems with solutions
    const withSolutions = problems.filter(p => p.solutions && p.solutions.length > 0).length;
    console.log(`\nProblems with Solutions: ${withSolutions}/${problems.length}`);

    console.log('\n' + '='.repeat(70));
    console.log('✨ Crawl completed successfully!');
    console.log('='.repeat(70));
  }
}

// CLI execution
const main = async () => {
  const crawler = new AMC2013B_Crawler();
  await crawler.crawl();
};

if (require.main === module) {
  main()
    .then(() => {
      console.log('Crawl script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Crawl script failed:', error);
      process.exit(1);
    });
}

export default AMC2013B_Crawler;
