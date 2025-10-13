import { Pool } from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export const redis = createClient({
  url: process.env.REDIS_URL
});

redis.on('error', (err) => console.error('Redis Client Error', err));

export const initializeDatabase = async () => {
  try {
    await redis.connect();
    console.log('Connected to Redis');

    await db.connect();
    console.log('Connected to PostgreSQL');

    await createTables();
    console.log('Database tables created/verified');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

const createTables = async () => {
  const queries = [
    `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,

    `CREATE TABLE IF NOT EXISTS tenants (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      subscription_tier VARCHAR(50) DEFAULT 'free',
      stripe_customer_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255),
      subscription_tier VARCHAR(50) DEFAULT 'free',
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      email_verified BOOLEAN DEFAULT FALSE,
      oauth_provider VARCHAR(50),
      oauth_id VARCHAR(255),
      role VARCHAR(50) DEFAULT 'user',
      two_factor_secret VARCHAR(255),
      two_factor_enabled BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS problems (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      source VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      difficulty VARCHAR(50) DEFAULT 'medium',
      subject VARCHAR(100) NOT NULL,
      exam_type VARCHAR(100),
      exam_year INTEGER,
      problem_number INTEGER,
      tags TEXT[],
      solution TEXT,
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS user_progress (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
      attempts INTEGER DEFAULT 0,
      correct_attempts INTEGER DEFAULT 0,
      last_reviewed_at TIMESTAMP,
      next_review_at TIMESTAMP,
      difficulty_rating DECIMAL(3,2) DEFAULT 2.5,
      mastery_level VARCHAR(50) DEFAULT 'learning',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, problem_id)
    );`,

    `CREATE TABLE IF NOT EXISTS study_sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      problems UUID[],
      session_type VARCHAR(50) DEFAULT 'practice',
      score DECIMAL(5,2),
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS spaced_repetition_cards (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
      interval INTEGER DEFAULT 1,
      repetitions INTEGER DEFAULT 0,
      easiness DECIMAL(3,2) DEFAULT 2.5,
      next_review TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, problem_id)
    );`,

    `CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(500) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(500) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(500) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE INDEX IF NOT EXISTS idx_problems_tenant ON problems(tenant_id);`,
    `CREATE INDEX IF NOT EXISTS idx_problems_category ON problems(category);`,
    `CREATE INDEX IF NOT EXISTS idx_problems_exam ON problems(exam_type, exam_year);`,
    `CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_spaced_repetition_next_review ON spaced_repetition_cards(next_review);`,
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
    `CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);`,
    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);`
  ];

  for (const query of queries) {
    await db.query(query);
  }
};