import { Request, Response } from 'express';
import { db } from '../models/database';

/**
 * Controller for accessing crawled AMC problems from database
 * Provides read-only access to public problem repository
 */
export class CrawledProblemsController {
  /**
   * Get list of all available tests
   * GET /api/v1/crawled/tests
   */
  async getTests(req: Request, res: Response): Promise<void> {
    try {
      const query = `
        SELECT DISTINCT
          exam_type,
          exam_year,
          COUNT(*) as problem_count,
          MIN(crawled_at) as crawled_at
        FROM problems
        WHERE crawled_at IS NOT NULL
        GROUP BY exam_type, exam_year
        ORDER BY exam_year DESC, exam_type
      `;

      const result = await db.query(query);

      res.json({
        success: true,
        totalTests: result.rows.length,
        tests: result.rows.map(row => ({
          examType: row.exam_type,
          examYear: row.exam_year,
          problemCount: parseInt(row.problem_count),
          crawledAt: row.crawled_at,
          // Extract variant (A or B) from exam_type like "AMC 10A"
          variant: row.exam_type?.match(/([AB])$/)?.[1] || null
        }))
      });
    } catch (error) {
      console.error('Error fetching tests:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tests'
      });
    }
  }

  /**
   * Get all problems for a specific test
   * GET /api/v1/crawled/tests/:year/:variant
   */
  async getTestProblems(req: Request, res: Response): Promise<void> {
    try {
      const { year, variant } = req.params;
      const examType = `AMC 10${variant.toUpperCase()}`;

      const query = `
        SELECT
          id,
          title,
          content,
          exam_type,
          exam_year,
          problem_number,
          difficulty,
          tags,
          solution,
          solutions,
          images,
          answer_choices_image,
          see_also,
          choices,
          crawl_source_url,
          crawled_at
        FROM problems
        WHERE exam_type = $1 AND exam_year = $2
        ORDER BY problem_number ASC
      `;

      const result = await db.query(query, [examType, parseInt(year)]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Test not found'
        });
        return;
      }

      res.json({
        success: true,
        metadata: {
          year: parseInt(year),
          test: examType,
          variant: variant.toUpperCase(),
          totalProblems: result.rows.length,
          crawledAt: result.rows[0]?.crawled_at
        },
        problems: result.rows.map(this.formatProblem)
      });
    } catch (error) {
      console.error('Error fetching test problems:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch test problems'
      });
    }
  }

  /**
   * Get a single problem by ID
   * GET /api/v1/crawled/problems/:id
   */
  async getProblem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const query = `
        SELECT
          id,
          title,
          content,
          source,
          category,
          difficulty,
          subject,
          exam_type,
          exam_year,
          problem_number,
          tags,
          solution,
          solutions,
          images,
          answer_choices_image,
          see_also,
          choices,
          crawl_source_url,
          crawled_at,
          created_at,
          updated_at
        FROM problems
        WHERE id = $1 AND crawled_at IS NOT NULL
      `;

      const result = await db.query(query, [id]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Problem not found'
        });
        return;
      }

      res.json({
        success: true,
        problem: this.formatProblem(result.rows[0])
      });
    } catch (error) {
      console.error('Error fetching problem:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch problem'
      });
    }
  }

  /**
   * Get index of all crawled data (similar to amc_index.json)
   * GET /api/v1/crawled/index
   */
  async getIndex(req: Request, res: Response): Promise<void> {
    try {
      const query = `
        SELECT
          exam_type,
          exam_year,
          COUNT(*) as problem_count,
          MIN(crawl_source_url) as source,
          MIN(crawled_at) as crawled_at
        FROM problems
        WHERE crawled_at IS NOT NULL
        GROUP BY exam_type, exam_year
        ORDER BY exam_year DESC, exam_type
      `;

      const result = await db.query(query);

      const tests = result.rows.map(row => {
        const variant = row.exam_type?.match(/([AB])$/)?.[1] || '';
        return {
          year: row.exam_year,
          variant: variant,
          test: row.exam_type,
          problemCount: parseInt(row.problem_count),
          source: row.source,
          crawledAt: row.crawled_at
        };
      });

      res.json({
        generatedAt: new Date().toISOString(),
        totalTests: tests.length,
        successfulTests: tests.length,
        failedTests: 0,
        tests: tests
      });
    } catch (error) {
      console.error('Error fetching index:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch index'
      });
    }
  }

  /**
   * Search crawled problems
   * GET /api/v1/crawled/search?q=<query>&year=<year>&difficulty=<difficulty>
   */
  async searchProblems(req: Request, res: Response): Promise<void> {
    try {
      const { q, year, difficulty, limit = '20', offset = '0' } = req.query;

      let query = `
        SELECT
          id,
          title,
          content,
          exam_type,
          exam_year,
          problem_number,
          difficulty,
          tags,
          answer_choices_image
        FROM problems
        WHERE crawled_at IS NOT NULL
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (q) {
        query += ` AND (title ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`;
        params.push(`%${q}%`);
        paramIndex++;
      }

      if (year) {
        query += ` AND exam_year = $${paramIndex}`;
        params.push(parseInt(year as string));
        paramIndex++;
      }

      if (difficulty) {
        query += ` AND difficulty = $${paramIndex}`;
        params.push(difficulty);
        paramIndex++;
      }

      query += ` ORDER BY exam_year DESC, problem_number ASC`;
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      const result = await db.query(query, params);

      res.json({
        success: true,
        total: result.rows.length,
        problems: result.rows.map(row => ({
          id: row.id,
          year: row.exam_year,
          test: row.exam_type,
          problemNumber: row.problem_number,
          title: row.title,
          content: row.content.substring(0, 200) + (row.content.length > 200 ? '...' : ''),
          difficulty: row.difficulty,
          topics: row.tags,
          answerChoicesImage: row.answer_choices_image
        }))
      });
    } catch (error) {
      console.error('Error searching problems:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search problems'
      });
    }
  }

  /**
   * Format problem data for API response
   */
  private formatProblem(row: any) {
    return {
      id: row.id,
      year: row.exam_year,
      test: row.exam_type?.match(/([AB])$/)?.[1] || '',
      problemNumber: row.problem_number,
      title: row.title,
      content: row.content,
      difficulty: row.difficulty,
      topics: row.tags || [],
      solutions: row.solutions || [],
      images: row.images || [],
      answerChoicesImage: row.answer_choices_image,
      seeAlso: row.see_also || [],
      choices: row.choices,
      source: row.crawl_source_url,
      crawledAt: row.crawled_at
    };
  }
}

export default new CrawledProblemsController();
