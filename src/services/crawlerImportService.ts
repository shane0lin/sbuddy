import { db } from '../models/database';
import { Problem } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for importing crawled problem data into the database
 * Transforms JSON format from crawler to database Problem format
 */
export class CrawlerImportService {
  private defaultTenantId: string = '';

  /**
   * Get or create a default tenant for crawled public problems
   */
  async getDefaultTenant(): Promise<string> {
    if (this.defaultTenantId) {
      return this.defaultTenantId;
    }

    // Check if 'public' tenant exists
    const checkQuery = `SELECT id FROM tenants WHERE name = 'public' LIMIT 1`;
    const result = await db.query(checkQuery);

    if (result.rows.length > 0) {
      this.defaultTenantId = result.rows[0].id;
      return this.defaultTenantId;
    }

    // Create public tenant
    const createQuery = `
      INSERT INTO tenants (id, name, subscription_tier)
      VALUES ($1, $2, $3)
      RETURNING id
    `;
    const tenantId = uuidv4();
    await db.query(createQuery, [tenantId, 'public', 'free']);

    this.defaultTenantId = tenantId;
    return tenantId;
  }

  /**
   * Transform crawled problem data to database format
   */
  transformCrawledProblem(crawledProblem: any, metadata?: any): Omit<Problem, 'id' | 'created_at' | 'updated_at'> {
    // Determine exam type (e.g., "AMC 10A" or "AMC 10B")
    const examType = `AMC 10${crawledProblem.test || metadata?.test || ''}`.trim();

    // Generate title from problem metadata
    const title = `${crawledProblem.year || metadata?.year || ''} ${examType} Problem ${crawledProblem.problemNumber || ''}`.trim();

    // Build source URL
    const sourceUrl = metadata?.source ||
      `https://artofproblemsolving.com/wiki/index.php/${crawledProblem.year}_AMC_10${crawledProblem.test}_Problems`;

    // Determine subject (default to Mathematics for AMC)
    const subject = 'Mathematics';

    // Category based on problem metadata or topics
    const category = crawledProblem.topics?.[0] || 'General';

    // Map difficulty
    const difficulty = this.mapDifficulty(crawledProblem.difficulty);

    return {
      title,
      content: crawledProblem.content || '',
      source: sourceUrl,
      category,
      difficulty,
      subject,
      exam_type: examType,
      exam_year: parseInt(crawledProblem.year) || metadata?.year || 0,
      problem_number: parseInt(crawledProblem.problemNumber) || 0,
      tags: crawledProblem.topics || [],
      solution: crawledProblem.solutions?.[0] || null,  // Store first solution in main field
      tenant_id: '', // Will be set during import
      // Crawler-specific fields
      solutions: crawledProblem.solutions || [],
      images: crawledProblem.images || [],
      answer_choices_image: crawledProblem.answerChoicesImage || null,
      see_also: crawledProblem.seeAlso || [],
      choices: crawledProblem.choices || null,
      crawl_source_url: sourceUrl,
      crawled_at: metadata?.crawledAt ? new Date(metadata.crawledAt) : new Date()
    };
  }

  /**
   * Map difficulty levels
   */
  private mapDifficulty(difficulty?: string): 'easy' | 'medium' | 'hard' {
    if (!difficulty) return 'medium';

    const lower = difficulty.toLowerCase();
    if (lower === 'easy' || lower === 'introductory') return 'easy';
    if (lower === 'hard' || lower === 'difficult' || lower === 'challenging') return 'hard';
    return 'medium';
  }

  /**
   * Import a single problem into the database
   * Uses UPSERT to handle duplicates
   */
  async importProblem(crawledProblem: any, metadata?: any, tenantId?: string): Promise<Problem> {
    const tenant = tenantId || await this.getDefaultTenant();
    const problemData = this.transformCrawledProblem(crawledProblem, metadata);
    problemData.tenant_id = tenant;

    const query = `
      INSERT INTO problems (
        id, title, content, source, category, difficulty, subject,
        exam_type, exam_year, problem_number, tags, solution, tenant_id,
        solutions, images, answer_choices_image, see_also, choices,
        crawl_source_url, crawled_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT ON CONSTRAINT idx_problems_unique_exam_problem
      DO UPDATE SET
        content = EXCLUDED.content,
        solutions = EXCLUDED.solutions,
        images = EXCLUDED.images,
        answer_choices_image = EXCLUDED.answer_choices_image,
        see_also = EXCLUDED.see_also,
        choices = EXCLUDED.choices,
        crawl_source_url = EXCLUDED.crawl_source_url,
        crawled_at = EXCLUDED.crawled_at,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      uuidv4(),
      problemData.title,
      problemData.content,
      problemData.source,
      problemData.category,
      problemData.difficulty,
      problemData.subject,
      problemData.exam_type,
      problemData.exam_year,
      problemData.problem_number,
      problemData.tags,
      problemData.solution,
      problemData.tenant_id,
      problemData.solutions,
      problemData.images,
      problemData.answer_choices_image,
      problemData.see_also,
      problemData.choices ? JSON.stringify(problemData.choices) : null,
      problemData.crawl_source_url,
      problemData.crawled_at
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Bulk import problems with transaction support
   */
  async bulkImport(
    crawledProblems: any[],
    metadata?: any,
    tenantId?: string
  ): Promise<{ imported: number; updated: number; errors: any[] }> {
    const tenant = tenantId || await this.getDefaultTenant();
    const client = await db.connect();

    let imported = 0;
    let updated = 0;
    const errors: any[] = [];

    try {
      await client.query('BEGIN');

      for (const crawledProblem of crawledProblems) {
        try {
          // Check if problem exists
          const checkQuery = `
            SELECT id FROM problems
            WHERE exam_type = $1 AND exam_year = $2 AND problem_number = $3 AND tenant_id = $4
          `;
          const examType = `AMC 10${crawledProblem.test || ''}`.trim();
          const checkResult = await client.query(checkQuery, [
            examType,
            crawledProblem.year,
            crawledProblem.problemNumber,
            tenant
          ]);

          const exists = checkResult.rows.length > 0;

          const problemData = this.transformCrawledProblem(crawledProblem, metadata);
          problemData.tenant_id = tenant;

          const query = `
            INSERT INTO problems (
              id, title, content, source, category, difficulty, subject,
              exam_type, exam_year, problem_number, tags, solution, tenant_id,
              solutions, images, answer_choices_image, see_also, choices,
              crawl_source_url, crawled_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            ON CONFLICT ON CONSTRAINT idx_problems_unique_exam_problem
            DO UPDATE SET
              content = EXCLUDED.content,
              solutions = EXCLUDED.solutions,
              images = EXCLUDED.images,
              answer_choices_image = EXCLUDED.answer_choices_image,
              see_also = EXCLUDED.see_also,
              choices = EXCLUDED.choices,
              crawl_source_url = EXCLUDED.crawl_source_url,
              crawled_at = EXCLUDED.crawled_at,
              updated_at = CURRENT_TIMESTAMP
            RETURNING *
          `;

          const values = [
            exists ? checkResult.rows[0].id : uuidv4(),
            problemData.title,
            problemData.content,
            problemData.source,
            problemData.category,
            problemData.difficulty,
            problemData.subject,
            problemData.exam_type,
            problemData.exam_year,
            problemData.problem_number,
            problemData.tags,
            problemData.solution,
            problemData.tenant_id,
            problemData.solutions,
            problemData.images,
            problemData.answer_choices_image,
            problemData.see_also,
            problemData.choices ? JSON.stringify(problemData.choices) : null,
            problemData.crawl_source_url,
            problemData.crawled_at
          ];

          await client.query(query, values);

          if (exists) {
            updated++;
          } else {
            imported++;
          }
        } catch (error) {
          errors.push({
            problem: crawledProblem,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      await client.query('COMMIT');
      return { imported, updated, errors };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Import from a crawled JSON file structure
   */
  async importFromFile(fileData: { metadata: any; problems: any[] }, tenantId?: string) {
    return this.bulkImport(fileData.problems, fileData.metadata, tenantId);
  }
}

export default new CrawlerImportService();
