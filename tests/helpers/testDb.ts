import { Pool } from 'pg';

export class TestDatabase {
  private pool: Pool;
  private static instance: TestDatabase;

  private constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase();
    }
    return TestDatabase.instance;
  }

  async query(text: string, params?: any[]) {
    return this.pool.query(text, params);
  }

  async setupTestTables() {
    // Create test tables
    await this.query(`
      CREATE TABLE IF NOT EXISTS test_tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS test_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        tenant_id UUID REFERENCES test_tenants(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS test_problems (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        tenant_id UUID REFERENCES test_tenants(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async cleanupTestTables() {
    await this.query('DROP TABLE IF EXISTS test_problems CASCADE');
    await this.query('DROP TABLE IF EXISTS test_users CASCADE');
    await this.query('DROP TABLE IF EXISTS test_tenants CASCADE');
  }

  async close() {
    await this.pool.end();
  }
}

export const testDb = TestDatabase.getInstance();