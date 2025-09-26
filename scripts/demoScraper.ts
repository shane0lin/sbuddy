import aopsScraper from '../src/services/aopsScraper';
import fs from 'fs';

class DemoScraper {
  async runDemo(): Promise<void> {
    console.log('🔍 AMC 10 Demo Scraper - No Database Required');
    console.log('='.repeat(50));

    try {
      // Test connection first
      console.log('\n1. Testing connection to Art of Problem Solving...');
      const testProblems = await aopsScraper.scrapeSpecificTest(2024, 'A', 1);

      if (testProblems.length === 0) {
        console.log('❌ Could not connect to AoPS or no problems found');
        return;
      }

      console.log('✅ Connection successful!');

      // Scrape a few problems for demo
      console.log('\n2. Scraping sample AMC 10 problems...');
      const problems = await aopsScraper.scrapeSpecificTest(2024, 'A', 5);

      console.log(`✅ Successfully scraped ${problems.length} problems`);

      // Display problems
      console.log('\n3. Sample Problems:');
      console.log('='.repeat(50));

      problems.forEach((problem, index) => {
        console.log(`\n📚 Problem ${index + 1}:`);
        console.log(`Year: ${problem.year}`);
        console.log(`Test: AMC 10${problem.test}`);
        console.log(`Problem #: ${problem.problemNumber}`);
        console.log(`Content: ${problem.content.substring(0, 200)}...`);

        if (problem.choices && problem.choices.length > 0) {
          console.log(`Answer Choices: ${problem.choices.length} options`);
          problem.choices.slice(0, 2).forEach(choice => {
            console.log(`  ${choice.substring(0, 50)}...`);
          });
        }

        if (problem.solutions && problem.solutions.length > 0) {
          console.log(`Solutions Found: ${problem.solutions.length}`);
          console.log(`First Solution: ${problem.solutions[0].substring(0, 150)}...`);
        }

        console.log('-'.repeat(30));
      });

      // Save to JSON file for inspection
      const outputFile = 'scraped_problems.json';
      fs.writeFileSync(outputFile, JSON.stringify(problems, null, 2));
      console.log(`\n💾 Problems saved to ${outputFile}`);

      // Show conversion to Sbuddy format
      console.log('\n4. Conversion to Sbuddy Format:');
      console.log('='.repeat(50));

      const sampleSbuddyProblem = aopsScraper.convertToSbuddyProblem(problems[0], 'demo-tenant-id');
      console.log('Sample converted problem:');
      console.log(`Title: ${sampleSbuddyProblem.title}`);
      console.log(`Subject: ${sampleSbuddyProblem.subject}`);
      console.log(`Exam Type: ${sampleSbuddyProblem.exam_type}`);
      console.log(`Category: ${sampleSbuddyProblem.category}`);
      console.log(`Difficulty: ${sampleSbuddyProblem.difficulty}`);
      console.log(`Tags: ${sampleSbuddyProblem.tags?.join(', ')}`);

      console.log('\n✨ Demo completed successfully!');
      console.log('\n📝 To import to database:');
      console.log('1. Set up PostgreSQL and Redis');
      console.log('2. Configure .env file');
      console.log('3. Run: npm run scrape-amc -- --year 2024 --test A --count 10');

    } catch (error) {
      console.error('❌ Demo failed:', error);
    }
  }

  async quickTest(): Promise<void> {
    console.log('🔍 Quick Connection Test...');

    try {
      const problems = await aopsScraper.scrapeSpecificTest(2024, 'A', 1);

      if (problems.length > 0) {
        console.log('✅ Success! Sample problem:');
        console.log(`${problems[0].year} AMC 10${problems[0].test} Problem ${problems[0].problemNumber}`);
        console.log(`Content: ${problems[0].content.substring(0, 100)}...`);
      } else {
        console.log('⚠️ Connection worked but no problems found');
      }
    } catch (error) {
      console.error('❌ Connection failed:', error);
    }
  }
}

// CLI interface
const main = async () => {
  const scraper = new DemoScraper();
  const args = process.argv.slice(2);

  if (args.includes('--quick')) {
    await scraper.quickTest();
  } else {
    await scraper.runDemo();
  }
};

if (require.main === module) {
  main().then(() => {
    console.log('\nDemo completed');
    process.exit(0);
  }).catch((error) => {
    console.error('Demo failed:', error);
    process.exit(1);
  });
}

export default DemoScraper;