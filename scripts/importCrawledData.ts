import fs from 'fs';
import path from 'path';
import crawlerImportService from '../src/services/crawlerImportService';
import { initializeDatabase } from '../src/models/database';

/**
 * Import all crawled JSON files into the database
 * Reads from crawled_data directory and uses crawlerImportService
 */
class CrawledDataImporter {
  private crawledDataDir = 'crawled_data';
  private stats = {
    filesProcessed: 0,
    totalImported: 0,
    totalUpdated: 0,
    totalErrors: 0,
    errorDetails: [] as any[]
  };

  async importAll(): Promise<void> {
    console.log('🚀 Starting import of crawled data to database');
    console.log('='.repeat(70));

    try {
      // Initialize database connection
      await initializeDatabase();
      console.log('✅ Database connection established\n');

      // Get all JSON files
      const files = this.getJSONFiles();
      console.log(`📁 Found ${files.length} JSON files to import\n`);

      // Import each file
      for (const file of files) {
        await this.importFile(file);
      }

      // Display summary
      this.displaySummary();

    } catch (error) {
      console.error('❌ Import failed:', error);
      throw error;
    }
  }

  private getJSONFiles(): string[] {
    const files = fs.readdirSync(this.crawledDataDir);

    return files
      .filter(file => {
        // Skip compact files and index files
        return file.endsWith('.json') &&
               !file.includes('_compact') &&
               file !== 'amc_index.json' &&
               file.includes('problems');
      })
      .map(file => path.join(this.crawledDataDir, file));
  }

  private async importFile(filePath: string): Promise<void> {
    const fileName = path.basename(filePath);
    console.log(`${'='.repeat(70)}`);
    console.log(`📄 Processing: ${fileName}`);
    console.log(`${'='.repeat(70)}`);

    try {
      // Read file
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(fileContent);

      // Validate structure
      if (!data.metadata || !data.problems || !Array.isArray(data.problems)) {
        console.error(`❌ Invalid file structure in ${fileName}`);
        this.stats.totalErrors++;
        return;
      }

      console.log(`📊 Metadata:`);
      console.log(`   Year: ${data.metadata.year}`);
      console.log(`   Test: ${data.metadata.test}`);
      console.log(`   Total Problems: ${data.metadata.totalProblems}`);
      console.log(`   Crawled At: ${data.metadata.crawledAt}`);
      console.log();

      // Import using service
      const result = await crawlerImportService.importFromFile(data);

      console.log(`✅ Import complete:`);
      console.log(`   New problems imported: ${result.imported}`);
      console.log(`   Existing problems updated: ${result.updated}`);
      console.log(`   Errors: ${result.errors.length}`);

      if (result.errors.length > 0) {
        console.log(`\n⚠️  Errors encountered:`);
        result.errors.forEach((err, idx) => {
          console.log(`   ${idx + 1}. Problem ${err.problem?.problemNumber}: ${err.error}`);
        });
      }

      console.log();

      // Update stats
      this.stats.filesProcessed++;
      this.stats.totalImported += result.imported;
      this.stats.totalUpdated += result.updated;
      this.stats.totalErrors += result.errors.length;
      this.stats.errorDetails.push(...result.errors);

    } catch (error) {
      console.error(`❌ Error processing ${fileName}:`, error);
      this.stats.totalErrors++;
      this.stats.errorDetails.push({
        file: fileName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private displaySummary(): void {
    console.log('\n' + '='.repeat(70));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(70));

    console.log(`\nFiles Processed: ${this.stats.filesProcessed}`);
    console.log(`New Problems Imported: ${this.stats.totalImported}`);
    console.log(`Existing Problems Updated: ${this.stats.totalUpdated}`);
    console.log(`Total Problems Affected: ${this.stats.totalImported + this.stats.totalUpdated}`);
    console.log(`Errors: ${this.stats.totalErrors}`);

    if (this.stats.errorDetails.length > 0) {
      console.log(`\n⚠️  Error Details:`);
      this.stats.errorDetails.slice(0, 10).forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err.file || 'Unknown file'}: ${err.error}`);
      });

      if (this.stats.errorDetails.length > 10) {
        console.log(`   ... and ${this.stats.errorDetails.length - 10} more errors`);
      }
    }

    console.log('\n' + '='.repeat(70));
    if (this.stats.totalErrors === 0) {
      console.log('✨ Import completed successfully!');
    } else {
      console.log('⚠️  Import completed with some errors');
    }
    console.log('='.repeat(70));
  }
}

// CLI execution
const main = async () => {
  const importer = new CrawledDataImporter();
  await importer.importAll();
};

if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Import script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Import script failed:', error);
      process.exit(1);
    });
}

export default CrawledDataImporter;
