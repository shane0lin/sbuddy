import aopsScraper from '../src/services/aopsScraper';
import crawlerImportService from '../src/services/crawlerImportService';
import { initializeDatabase } from '../src/models/database';
import fs from 'fs';
import path from 'path';

/**
 * Crawl All AMC 10 Tests
 * Crawls multiple AMC 10 tests and saves to separate files
 */
class AMC10AllCrawler {
  private outputDir = 'crawled_data';

  // Define tests to crawl (recent years for better quality)
  private testsToCrawl: Array<{year: number, variant: 'A' | 'B'}> = [
    // 2024
    { year: 2024, variant: 'A' as 'A' },
    { year: 2024, variant: 'B' as 'B' },
    // 2023
    { year: 2023, variant: 'A' as 'A' },
    { year: 2023, variant: 'B' as 'B' },
    // 2022
    { year: 2022, variant: 'A' as 'A' },
    { year: 2022, variant: 'B' as 'B' },
    // 2021
    { year: 2021, variant: 'A' as 'A' },
    { year: 2021, variant: 'B' as 'B' },
    // 2020
    { year: 2020, variant: 'A' as 'A' },
    { year: 2020, variant: 'B' as 'B' },
    // 2019
    { year: 2019, variant: 'A' as 'A' },
    { year: 2019, variant: 'B' as 'B' },
    // 2018
    { year: 2018, variant: 'A' as 'A' },
    { year: 2018, variant: 'B' as 'B' },
    // 2017
    { year: 2017, variant: 'A' as 'A' },
    { year: 2017, variant: 'B' as 'B' },
    // 2016
    { year: 2016, variant: 'A' as 'A' },
    { year: 2016, variant: 'B' as 'B' },
    // 2015
    { year: 2015, variant: 'A' as 'A' },
    { year: 2015, variant: 'B' as 'B' },
    // 2014
    { year: 2014, variant: 'A' as 'A' },
    { year: 2014, variant: 'B' as 'B' },
    // 2013
    { year: 2013, variant: 'A' as 'A' },
    { year: 2013, variant: 'B' as 'B' },
    // 2012
    { year: 2012, variant: 'A' as 'A' },
    { year: 2012, variant: 'B' as 'B' },
  ];

  async crawl(): Promise<void> {
    console.log('🔍 Starting crawl of multiple AMC 10 Tests');
    console.log('='.repeat(70));
    console.log(`Tests to crawl: ${this.testsToCrawl.length}`);
    console.log('='.repeat(70));

    try {
      // Initialize database
      await initializeDatabase();
      console.log('✅ Database connection established\n');

      // Ensure output directory exists
      this.ensureOutputDirectory();

      const allResults: any[] = [];

      for (const test of this.testsToCrawl) {
        await this.crawlSingleTest(test.year, test.variant, allResults);

        // Delay between tests to be respectful to the server
        await this.sleep(2000);
      }

      // Save combined index
      this.saveCombinedIndex(allResults);

      // Display final summary
      this.displayFinalSummary(allResults);

    } catch (error) {
      console.error('❌ Crawl failed:', error);
      throw error;
    }
  }

  private async crawlSingleTest(year: number, variant: 'A' | 'B', allResults: any[]): Promise<void> {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📚 Crawling ${year} AMC 10${variant}...`);
    console.log(`${'='.repeat(70)}`);

    try {
      const problems = await aopsScraper.scrapeSpecificTest(year, variant, 25);

      console.log(`✅ Successfully crawled ${problems.length} problems from ${year} AMC 10${variant}`);

      // Save individual test file (backup)
      const outputPath = path.join(this.outputDir, `amc_${year}_10${variant.toLowerCase()}_problems.json`);
      this.saveToFile(problems, outputPath, year, `AMC 10${variant}`);

      // Save to database
      const metadata = {
        crawledAt: new Date().toISOString(),
        source: `https://artofproblemsolving.com/wiki/index.php/${year}_AMC_10${variant}_Problems`,
        year: year,
        test: `AMC 10${variant}`,
        totalProblems: problems.length
      };
      await this.saveToDatabase(problems, metadata);

      // Add to combined results
      allResults.push({
        year,
        variant,
        test: `AMC 10${variant}`,
        problemCount: problems.length,
        filePath: outputPath,
        metadata: {
          crawledAt: new Date().toISOString(),
          source: `https://artofproblemsolving.com/wiki/index.php/${year}_AMC_10${variant}_Problems`,
        }
      });

    } catch (error) {
      console.error(`❌ Error crawling ${year} AMC 10${variant}:`, error);
      allResults.push({
        year,
        variant,
        test: `AMC 10${variant}`,
        error: error instanceof Error ? error.message : 'Unknown error',
        problemCount: 0
      });
    }
  }

  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      console.log(`✓ Created output directory: ${this.outputDir}`);
    }
  }

  private saveToFile(problems: any[], filePath: string, year: number, test: string): void {
    const data = {
      metadata: {
        crawledAt: new Date().toISOString(),
        source: `https://artofproblemsolving.com/wiki/index.php/${year}_${test.replace(' ', '_')}_Problems`,
        year: year,
        test: test,
        totalProblems: problems.length
      },
      problems: problems
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`💾 Saved to: ${filePath}`);
  }

  private saveCombinedIndex(allResults: any[]): void {
    const indexPath = path.join(this.outputDir, 'amc_index.json');

    const indexData = {
      generatedAt: new Date().toISOString(),
      totalTests: allResults.length,
      successfulTests: allResults.filter(r => r.problemCount > 0).length,
      failedTests: allResults.filter(r => r.error).length,
      tests: allResults.map(r => ({
        year: r.year,
        variant: r.variant,
        test: r.test,
        problemCount: r.problemCount,
        filePath: r.filePath,
        error: r.error,
        source: r.metadata?.source
      }))
    };

    fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2), 'utf-8');
    console.log(`\n📑 Combined index saved to: ${indexPath}`);
  }

  private displayFinalSummary(allResults: any[]): void {
    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL CRAWL SUMMARY');
    console.log('='.repeat(70));

    const successful = allResults.filter(r => r.problemCount > 0);
    const failed = allResults.filter(r => r.error);

    console.log(`\nTotal Tests Attempted: ${allResults.length}`);
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);

    const totalProblems = successful.reduce((sum, r) => sum + r.problemCount, 0);
    console.log(`\nTotal Problems Crawled: ${totalProblems}`);

    if (successful.length > 0) {
      console.log(`\n✅ Successfully Crawled Tests:`);
      successful.forEach(r => {
        console.log(`   - ${r.year} ${r.test}: ${r.problemCount} problems`);
      });
    }

    if (failed.length > 0) {
      console.log(`\n❌ Failed Tests:`);
      failed.forEach(r => {
        console.log(`   - ${r.year} ${r.test}: ${r.error}`);
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log('✨ Crawl process completed!');
    console.log('='.repeat(70));
  }

  private async saveToDatabase(problems: any[], metadata: any): Promise<void> {
    try {
      const result = await crawlerImportService.bulkImport(problems, metadata);
      console.log(`💾 Database: ${result.imported} new, ${result.updated} updated, ${result.errors.length} errors`);
    } catch (error) {
      console.error('⚠️  Database import failed:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI execution
const main = async () => {
  const crawler = new AMC10AllCrawler();
  await crawler.crawl();
};

if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ All crawl operations completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Crawl script failed:', error);
      process.exit(1);
    });
}

export default AMC10AllCrawler;
