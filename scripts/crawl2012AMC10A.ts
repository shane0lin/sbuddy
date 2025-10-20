import aopsScraper from '../src/services/aopsScraper';
import fs from 'fs';
import path from 'path';

/**
 * Crawl 2012 AMC 10A Problems
 * Saves results to a separate JSON file
 */
class AMC2012Crawler {
  private outputDir = 'crawled_data';
  private outputFile = 'amc_2012_10a_problems.json';

  async crawl(): Promise<void> {
    console.log('🔍 Starting crawl of 2012 AMC 10A Problems');
    console.log('URL: https://artofproblemsolving.com/wiki/index.php/2012_AMC_10A_Problems');
    console.log('='.repeat(70));

    try {
      // Ensure output directory exists
      this.ensureOutputDirectory();

      // Crawl all 25 problems from 2012 AMC 10A
      console.log('\n📚 Crawling all 25 problems from 2012 AMC 10A...\n');
      const problems = await aopsScraper.scrapeSpecificTest(2012, 'A', 25);

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
        source: 'https://artofproblemsolving.com/wiki/index.php/2012_AMC_10A_Problems',
        year: 2012,
        test: 'AMC 10A',
        totalProblems: problems.length
      },
      problems: problems
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`\n💾 Results saved to: ${filePath}`);

    // Also save a compact version
    const compactPath = filePath.replace('.json', '_compact.json');
    fs.writeFileSync(compactPath, JSON.stringify(data), 'utf-8');
    console.log(`💾 Compact version saved to: ${compactPath}`);
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

    // Count problems with images
    const withImages = problems.filter(p => p.images && p.images.length > 0).length;
    console.log(`Problems with Images: ${withImages}/${problems.length}`);

    // Average number of solutions
    const avgSolutions = problems.reduce((sum, p) => sum + (p.solutions?.length || 0), 0) / problems.length;
    console.log(`Average Solutions per Problem: ${avgSolutions.toFixed(1)}`);

    // File size
    const stats = fs.statSync(outputPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`\nOutput File Size: ${fileSizeMB} MB`);

    console.log('\n' + '='.repeat(70));
    console.log('✨ Crawl completed successfully!');
    console.log('='.repeat(70));

    // Display first 3 problems as samples
    console.log('\n📋 SAMPLE PROBLEMS (First 3):');
    console.log('='.repeat(70));

    problems.slice(0, 3).forEach((problem, index) => {
      console.log(`\n${index + 1}. Problem ${problem.problemNumber}`);
      console.log(`   Year: ${problem.year}, Test: ${problem.test}`);
      console.log(`   Difficulty: ${problem.difficulty}`);
      console.log(`   Content: ${problem.content.substring(0, 150)}...`);
      console.log(`   Solutions: ${problem.solutions?.length || 0}`);
      console.log(`   Topics: ${problem.topics?.join(', ') || 'None'}`);
      console.log(`   Images: ${problem.images?.length || 0}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log(`\n📂 Full results available in: ${outputPath}`);
    console.log('');
  }
}

// CLI execution
const main = async () => {
  const crawler = new AMC2012Crawler();
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

export default AMC2012Crawler;
