import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

interface Migration {
  filename: string;
  version: number;
}

async function createMigrationsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      version INTEGER UNIQUE NOT NULL,
      filename VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await pool.query(query);
  console.log('✅ Migrations table created/verified');
}

async function getExecutedMigrations(): Promise<number[]> {
  const result = await pool.query('SELECT version FROM migrations ORDER BY version');
  return result.rows.map(row => row.version);
}

async function executeMigration(migration: Migration, sql: string) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Execute migration SQL
    await client.query(sql);

    // Record migration
    await client.query(
      'INSERT INTO migrations (version, filename) VALUES ($1, $2)',
      [migration.version, migration.filename]
    );

    await client.query('COMMIT');
    console.log(`✅ Migration ${migration.filename} completed successfully`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Migration ${migration.filename} failed:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function runMigrations() {
  try {
    console.log('🚀 Starting database migrations...\n');

    // Create migrations table
    await createMigrationsTable();

    // Get executed migrations
    const executedVersions = await getExecutedMigrations();
    console.log(`📊 Executed migrations: ${executedVersions.join(', ') || 'none'}\n`);

    // Read migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('⚠️  No migration files found');
      return;
    }

    console.log(`📁 Found ${files.length} migration file(s)\n`);

    // Parse and execute migrations
    const migrations: Migration[] = files.map(filename => {
      const match = filename.match(/^(\d+)_/);
      if (!match) {
        throw new Error(`Invalid migration filename: ${filename}. Must start with version number (e.g., 001_name.sql)`);
      }
      return {
        filename,
        version: parseInt(match[1], 10)
      };
    });

    // Filter pending migrations
    const pendingMigrations = migrations.filter(
      m => !executedVersions.includes(m.version)
    );

    if (pendingMigrations.length === 0) {
      console.log('✨ All migrations are up to date!');
      return;
    }

    console.log(`📝 Pending migrations: ${pendingMigrations.length}\n`);

    // Execute pending migrations
    for (const migration of pendingMigrations) {
      const filepath = path.join(migrationsDir, migration.filename);
      const sql = fs.readFileSync(filepath, 'utf-8');

      console.log(`⏳ Executing migration: ${migration.filename}...`);
      await executeMigration(migration, sql);
    }

    console.log('\n🎉 All migrations completed successfully!');

  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Check if running directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };
