import dotenv from 'dotenv';
import { initializeDatabase } from '../src/models/database';
import aopsScraper from '../src/services/aopsScraper';
import problemRepository from '../src/services/problemRepository';
import authService from '../src/services/authService';

dotenv.config();

interface ScrapingOptions {
  year?: number;
  test?: 'A' | 'B';
  problemCount?: number;
  fullScrape?: boolean;
  tenantName?: string;
}

class AMCScrapingScript {
  private defaultTenantId: string = '';

  async run(options: ScrapingOptions = {}) {
    try {
      console.log('🚀 Starting AMC 10 scraping script...');

      // Initialize database
      await initializeDatabase();
      console.log('✓ Database initialized');

      // Create or get tenant
      await this.ensureTenant(options.tenantName || 'aops-scraped');

      if (options.fullScrape) {
        await this.fullScrape();
      } else if (options.year && options.test) {
        await this.testScrape(options.year, options.test, options.problemCount || 5);
      } else {
        await this.testScrape(2024, 'A', 3); // Default test
      }

      console.log('✅ Scraping completed successfully!');
    } catch (error) {
      console.error('❌ Scraping failed:', error);
      process.exit(1);
    }
  }

  private async ensureTenant(tenantName: string): Promise<void> {
    try {
      // Create a system user for scraping if needed
      const email = `scraper@${tenantName}.com`;

      try {
        const result = await authService.register(email, 'scraper-password-123');
        this.defaultTenantId = result.user.tenant_id;
        console.log(`✓ Created tenant: ${tenantName} (${this.defaultTenantId})`);
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          const user = await authService.getUserByEmail(email);
          if (user) {
            this.defaultTenantId = user.tenant_id;
            console.log(`✓ Using existing tenant: ${tenantName} (${this.defaultTenantId})`);
          }
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Failed to create tenant:', error);
      throw error;
    }
  }

  private async testScrape(year: number, test: 'A' | 'B', problemCount: number): Promise<void> {
    console.log(`\n📚 Test scraping: ${year} AMC 10${test} (${problemCount} problems)`);

    const problems = await aopsScraper.scrapeSpecificTest(year, test, problemCount);

    console.log(`\n💾 Importing ${problems.length} problems to database...`);

    const sbuddyProblems = problems.map(p =>
      aopsScraper.convertToSbuddyProblem(p, this.defaultTenantId)
    );

    const imported = await problemRepository.bulkImportProblems(sbuddyProblems);

    console.log(`✓ Successfully imported ${imported.length} problems`);

    // Show sample of imported problems
    console.log('\n📋 Sample imported problems:');
    imported.slice(0, 3).forEach((problem, index) => {
      console.log(`${index + 1}. ${problem.title}`);
      console.log(`   Content: ${problem.content.substring(0, 150)}...`);
      console.log(`   Tags: ${problem.tags?.join(', ')}`);
      console.log('');
    });
  }

  private async fullScrape(): Promise<void> {
    console.log('\n🔄 Starting full AMC 10 scraping (this may take a while)...');

    const allProblems = await aopsScraper.scrapeAllAMC10Problems();

    console.log(`\n💾 Importing ${allProblems.length} problems to database...`);

    const sbuddyProblems = allProblems.map(p =>
      aopsScraper.convertToSbuddyProblem(p, this.defaultTenantId)
    );

    // Import in batches to avoid overwhelming the database
    const batchSize = 50;
    let totalImported = 0;

    for (let i = 0; i < sbuddyProblems.length; i += batchSize) {
      const batch = sbuddyProblems.slice(i, i + batchSize);

      try {
        const imported = await problemRepository.bulkImportProblems(batch);
        totalImported += imported.length;

        console.log(`✓ Imported batch ${Math.floor(i / batchSize) + 1}: ${imported.length} problems (Total: ${totalImported})`);
      } catch (error) {
        console.error(`❌ Error importing batch ${Math.floor(i / batchSize) + 1}:`, error);
      }
    }

    console.log(`✅ Full scraping completed! Imported ${totalImported} total problems`);

    // Get statistics
    const stats = await problemRepository.getStatistics(this.defaultTenantId);
    console.log('\n📊 Final statistics:', stats);
  }

  async testConnection(): Promise<void> {
    console.log('🔍 Testing connection to Art of Problem Solving...');

    try {
      const testProblems = await aopsScraper.scrapeSpecificTest(2024, 'A', 1);

      if (testProblems.length > 0) {
        console.log('✅ Connection successful! Sample problem:');
        console.log(`Title: ${testProblems[0].year} AMC 10${testProblems[0].test} Problem ${testProblems[0].problemNumber}`);
        console.log(`Content: ${testProblems[0].content.substring(0, 200)}...`);
      } else {
        console.log('⚠️ Connection successful but no problems found');
      }
    } catch (error) {
      console.error('❌ Connection failed:', error);
    }
  }
}

// Command line interface
const main = async () => {
  const args = process.argv.slice(2);
  const scraper = new AMCScrapingScript();

  if (args.includes('--help')) {
    console.log(`
AMC 10 Scraping Script

Usage:
  npm run scrape-amc [options]

Options:
  --test-connection  Test connection to AoPS
  --full-scrape     Scrape all available AMC 10 problems
  --year YEAR       Scrape specific year (default: 2024)
  --test A|B        Scrape specific test (default: A)
  --count N         Number of problems to scrape in test mode (default: 3)
  --tenant NAME     Tenant name for organizing problems (default: aops-scraped)
  --help            Show this help

Examples:
  npm run scrape-amc --test-connection
  npm run scrape-amc --year 2023 --test B --count 10
  npm run scrape-amc --full-scrape --tenant my-school
    `);
    return;
  }

  if (args.includes('--test-connection')) {
    await scraper.testConnection();
    return;
  }

  const options: ScrapingOptions = {
    fullScrape: args.includes('--full-scrape'),
    year: args.includes('--year') ? parseInt(args[args.indexOf('--year') + 1]) : undefined,
    test: args.includes('--test') ? args[args.indexOf('--test') + 1] as 'A' | 'B' : undefined,
    problemCount: args.includes('--count') ? parseInt(args[args.indexOf('--count') + 1]) : undefined,
    tenantName: args.includes('--tenant') ? args[args.indexOf('--tenant') + 1] : undefined
  };

  await scraper.run(options);
};

// Handle script execution
if (require.main === module) {
  main().then(() => {
    console.log('Script completed');
    process.exit(0);
  }).catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

export default AMCScrapingScript;