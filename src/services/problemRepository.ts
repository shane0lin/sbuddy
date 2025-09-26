import { db } from '../models/database';
import { Problem } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class ProblemRepositoryService {
  async createProblem(problemData: Omit<Problem, 'id' | 'created_at' | 'updated_at'>): Promise<Problem> {
    const query = `
      INSERT INTO problems (
        id, title, content, source, category, difficulty, subject,
        exam_type, exam_year, problem_number, tags, solution, tenant_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
      problemData.tenant_id
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  async getProblemById(id: string, tenantId: string): Promise<Problem | null> {
    const query = 'SELECT * FROM problems WHERE id = $1 AND tenant_id = $2';
    const result = await db.query(query, [id, tenantId]);
    return result.rows[0] || null;
  }

  async searchProblems(
    tenantId: string,
    filters: {
      subject?: string;
      category?: string;
      difficulty?: string;
      examType?: string;
      examYear?: number;
      tags?: string[];
      search?: string;
    },
    limit: number = 20,
    offset: number = 0
  ): Promise<{ problems: Problem[]; total: number }> {
    let query = 'SELECT * FROM problems WHERE tenant_id = $1';
    let countQuery = 'SELECT COUNT(*) FROM problems WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.subject) {
      query += ` AND subject ILIKE $${paramIndex}`;
      countQuery += ` AND subject ILIKE $${paramIndex}`;
      params.push(`%${filters.subject}%`);
      paramIndex++;
    }

    if (filters.category) {
      query += ` AND category ILIKE $${paramIndex}`;
      countQuery += ` AND category ILIKE $${paramIndex}`;
      params.push(`%${filters.category}%`);
      paramIndex++;
    }

    if (filters.difficulty) {
      query += ` AND difficulty = $${paramIndex}`;
      countQuery += ` AND difficulty = $${paramIndex}`;
      params.push(filters.difficulty);
      paramIndex++;
    }

    if (filters.examType) {
      query += ` AND exam_type ILIKE $${paramIndex}`;
      countQuery += ` AND exam_type ILIKE $${paramIndex}`;
      params.push(`%${filters.examType}%`);
      paramIndex++;
    }

    if (filters.examYear) {
      query += ` AND exam_year = $${paramIndex}`;
      countQuery += ` AND exam_year = $${paramIndex}`;
      params.push(filters.examYear);
      paramIndex++;
    }

    if (filters.tags && filters.tags.length > 0) {
      query += ` AND tags && $${paramIndex}`;
      countQuery += ` AND tags && $${paramIndex}`;
      params.push(filters.tags);
      paramIndex++;
    }

    if (filters.search) {
      query += ` AND (title ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`;
      countQuery += ` AND (title ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const [problemsResult, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2)) // Remove limit and offset for count
    ]);

    return {
      problems: problemsResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  async findSimilarProblems(
    content: string,
    tenantId: string,
    limit: number = 10
  ): Promise<Problem[]> {
    // Using PostgreSQL full-text search for similarity
    const query = `
      SELECT *,
        ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) as rank
      FROM problems
      WHERE tenant_id = $2
        AND to_tsvector('english', content) @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT $3
    `;

    const result = await db.query(query, [content, tenantId, limit]);
    return result.rows;
  }

  async updateProblem(
    id: string,
    tenantId: string,
    updates: Partial<Omit<Problem, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>
  ): Promise<Problem | null> {
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 3}`)
      .join(', ');

    const query = `
      UPDATE problems
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `;

    const values = [id, tenantId, ...Object.values(updates)];
    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  async deleteProblem(id: string, tenantId: string): Promise<boolean> {
    const query = 'DELETE FROM problems WHERE id = $1 AND tenant_id = $2';
    const result = await db.query(query, [id, tenantId]);
    return (result.rowCount || 0) > 0;
  }

  async getStatistics(tenantId: string) {
    const query = `
      SELECT
        COUNT(*) as total_problems,
        COUNT(DISTINCT subject) as subjects_count,
        COUNT(DISTINCT category) as categories_count,
        COUNT(DISTINCT exam_type) as exam_types_count
      FROM problems
      WHERE tenant_id = $1
    `;

    const result = await db.query(query, [tenantId]);
    return result.rows[0];
  }

  async bulkImportProblems(problems: Omit<Problem, 'id' | 'created_at' | 'updated_at'>[]): Promise<Problem[]> {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      const insertedProblems: Problem[] = [];

      for (const problem of problems) {
        const query = `
          INSERT INTO problems (
            id, title, content, source, category, difficulty, subject,
            exam_type, exam_year, problem_number, tags, solution, tenant_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        `;

        const values = [
          uuidv4(),
          problem.title,
          problem.content,
          problem.source,
          problem.category,
          problem.difficulty,
          problem.subject,
          problem.exam_type,
          problem.exam_year,
          problem.problem_number,
          problem.tags,
          problem.solution,
          problem.tenant_id
        ];

        const result = await client.query(query, values);
        insertedProblems.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return insertedProblems;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export default new ProblemRepositoryService();