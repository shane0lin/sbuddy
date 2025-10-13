# Database Migrations

This directory contains SQL migration files for the Sbuddy database schema.

## Running Migrations

To run all pending migrations:

```bash
npm run migrate
```

This will:
1. Create a `migrations` table if it doesn't exist
2. Check which migrations have already been executed
3. Run any pending migrations in order
4. Record successful migrations in the `migrations` table

## Migration File Naming Convention

Migration files must follow this naming pattern:

```
XXX_description.sql
```

Where:
- `XXX` is a 3-digit version number (e.g., `001`, `002`, `003`)
- `description` is a brief description using underscores (e.g., `initial_schema`, `add_study_sets`)

**Examples:**
- `001_initial_schema.sql`
- `002_add_study_sets.sql`
- `003_add_multi_subject_support.sql`

## Creating a New Migration

1. Create a new SQL file in this directory
2. Use the next available version number
3. Write your migration SQL
4. Test locally before committing

**Example migration file:**

```sql
-- Migration: 002_add_study_sets.sql
-- Description: Add study sets feature
-- Date: 2025-10-13

CREATE TABLE IF NOT EXISTS study_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_study_sets_user ON study_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sets_public ON study_sets(is_public);

-- Add comments
COMMENT ON TABLE study_sets IS 'User-created study sets for organizing problems';
```

## Migration Best Practices

1. **Use IF NOT EXISTS**: Always use `IF NOT EXISTS` when creating tables, indexes, etc.
2. **Make migrations idempotent**: Migrations should be safe to run multiple times
3. **Use transactions**: The migration runner wraps each migration in a transaction
4. **Add comments**: Include descriptive comments in your SQL
5. **Test rollback strategy**: Consider how you would undo the migration if needed
6. **Keep migrations focused**: One migration = one logical change
7. **Don't modify existing migrations**: Once deployed, never edit a migration file

## Migration Status

Check which migrations have been executed:

```sql
SELECT * FROM migrations ORDER BY version;
```

## Rollback (Manual)

If you need to rollback a migration, you'll need to manually write and execute the reverse SQL. Consider creating a `rollback/` directory with corresponding rollback scripts.

**Example structure:**
```
migrations/
  001_initial_schema.sql
  002_add_study_sets.sql
  rollback/
    002_rollback_study_sets.sql
```

## Current Schema

The current database schema includes:

### Core Tables
- `tenants` - Multi-tenancy organization
- `users` - User accounts (email/OAuth)
- `refresh_tokens` - JWT refresh token storage
- `email_verification_tokens` - Email verification
- `password_reset_tokens` - Password reset flow

### Problem Repository
- `problems` - Problem storage with full-text search
- `user_progress` - User progress per problem
- `study_sessions` - Study session tracking
- `spaced_repetition_cards` - SM-2 algorithm data

### Gamification
- `user_scores` - Points, levels, streaks, achievements

## Troubleshooting

**Migration fails with "permission denied"**
- Check your DATABASE_URL has correct credentials
- Ensure your database user has CREATE TABLE privileges

**Migration shows as pending but was already run**
- Check if the migration exists in the `migrations` table
- Verify the version number matches exactly

**Need to force re-run a migration**
- Delete the entry from the `migrations` table (not recommended for production)
- Consider creating a new migration instead

## Development vs Production

**Development:**
- Feel free to experiment with migrations
- You can drop and recreate your local database as needed
- Test migrations thoroughly before committing

**Production:**
- Always test migrations on staging first
- Never edit existing migrations
- Always have a rollback plan
- Consider downtime requirements
- Coordinate with team members

## Additional Commands

**Check database connection:**
```bash
npm run scrape-amc:test
```

**Reset local database (DANGEROUS):**
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO your_user;
```

Then run migrations again:
```bash
npm run migrate
```
