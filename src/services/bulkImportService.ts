import { db } from '../models/database';
import { Problem } from '../types';
import { v4 as uuidv4 } from 'uuid';
import problemRepository from './problemRepository';

interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  failed: number;
  errors: Array<{ row: number; error: string; data?: any }>;
  problems: Problem[];
}

interface CSVProblem {
  title: string;
  content: string;
  source: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  subject: string;
  exam_type?: string;
  exam_year?: number;
  problem_number?: number;
  tags?: string;  // Comma-separated
  solution?: string;
}

export class BulkImportService {
  /**
   * Parse CSV content into problem objects
   */
  parseCSV(csvContent: string): CSVProblem[] {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const problems: CSVProblem[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);

      if (values.length === 0 || values.every(v => !v)) {
        continue; // Skip empty lines
      }

      const problem: any = {};
      headers.forEach((header, index) => {
        if (values[index]) {
          problem[header.replace(/ /g, '_')] = values[index].trim();
        }
      });

      problems.push(problem as CSVProblem);
    }

    return problems;
  }

  /**
   * Parse a single CSV line, handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Validate a single problem
   */
  validateProblem(problem: any, row: number): string | null {
    if (!problem.title || problem.title.length < 3) {
      return `Row ${row}: Title is required and must be at least 3 characters`;
    }

    if (!problem.content || problem.content.length < 10) {
      return `Row ${row}: Content is required and must be at least 10 characters`;
    }

    if (!problem.source) {
      return `Row ${row}: Source is required`;
    }

    if (!problem.category) {
      return `Row ${row}: Category is required`;
    }

    if (!problem.subject) {
      return `Row ${row}: Subject is required`;
    }

    if (problem.difficulty && !['easy', 'medium', 'hard'].includes(problem.difficulty.toLowerCase())) {
      return `Row ${row}: Difficulty must be 'easy', 'medium', or 'hard'`;
    }

    if (problem.exam_year && isNaN(parseInt(problem.exam_year))) {
      return `Row ${row}: Exam year must be a number`;
    }

    if (problem.problem_number && isNaN(parseInt(problem.problem_number))) {
      return `Row ${row}: Problem number must be a number`;
    }

    return null;
  }

  /**
   * Bulk import problems from array
   */
  async importProblems(
    problems: Omit<Problem, 'id' | 'created_at' | 'updated_at'>[],
    tenantId: string,
    validateOnly: boolean = false
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      total: problems.length,
      imported: 0,
      failed: 0,
      errors: [],
      problems: []
    };

    // Validate all problems first
    problems.forEach((problem, index) => {
      const error = this.validateProblem(problem, index + 1);
      if (error) {
        result.errors.push({
          row: index + 1,
          error,
          data: problem
        });
      }
    });

    // If validation only, return now
    if (validateOnly) {
      result.success = result.errors.length === 0;
      return result;
    }

    // If there are validation errors, don't proceed
    if (result.errors.length > 0) {
      result.failed = result.errors.length;
      return result;
    }

    // Import problems in transaction
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      for (let i = 0; i < problems.length; i++) {
        try {
          const problem = {
            ...problems[i],
            tenant_id: tenantId
          };

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
            problem.difficulty || 'medium',
            problem.subject,
            problem.exam_type || null,
            problem.exam_year || null,
            problem.problem_number || null,
            problem.tags || [],
            problem.solution || null,
            problem.tenant_id
          ];

          const queryResult = await client.query(query, values);
          result.problems.push(queryResult.rows[0]);
          result.imported++;
        } catch (error: any) {
          result.failed++;
          result.errors.push({
            row: i + 1,
            error: error.message,
            data: problems[i]
          });
        }
      }

      await client.query('COMMIT');
      result.success = result.imported > 0;
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw new Error(`Bulk import failed: ${error.message}`);
    } finally {
      client.release();
    }

    return result;
  }

  /**
   * Import from CSV string
   */
  async importFromCSV(
    csvContent: string,
    tenantId: string,
    validateOnly: boolean = false
  ): Promise<ImportResult> {
    try {
      const csvProblems = this.parseCSV(csvContent);

      // Convert CSV problems to Problem format
      const problems = csvProblems.map(p => ({
        title: p.title,
        content: p.content,
        source: p.source,
        category: p.category,
        difficulty: (p.difficulty?.toLowerCase() as 'easy' | 'medium' | 'hard') || 'medium',
        subject: p.subject,
        exam_type: p.exam_type || '',
        exam_year: p.exam_year ? parseInt(p.exam_year.toString()) : 0,
        problem_number: p.problem_number ? parseInt(p.problem_number.toString()) : 0,
        tags: p.tags ? p.tags.split(',').map(t => t.trim()) : [],
        solution: p.solution || '',
        tenant_id: tenantId
      }));

      return await this.importProblems(problems, tenantId, validateOnly);
    } catch (error: any) {
      return {
        success: false,
        total: 0,
        imported: 0,
        failed: 0,
        errors: [{ row: 0, error: `CSV parsing error: ${error.message}` }],
        problems: []
      };
    }
  }

  /**
   * Import problems from JSON array
   */
  async importFromJSON(
    jsonContent: string,
    tenantId: string,
    validateOnly: boolean = false
  ): Promise<ImportResult> {
    try {
      const problems = JSON.parse(jsonContent);

      if (!Array.isArray(problems)) {
        throw new Error('JSON content must be an array of problems');
      }

      return await this.importProblems(problems, tenantId, validateOnly);
    } catch (error: any) {
      return {
        success: false,
        total: 0,
        imported: 0,
        failed: 0,
        errors: [{ row: 0, error: `JSON parsing error: ${error.message}` }],
        problems: []
      };
    }
  }

  /**
   * Generate CSV template
   */
  generateCSVTemplate(): string {
    const headers = [
      'title',
      'content',
      'source',
      'category',
      'difficulty',
      'subject',
      'exam_type',
      'exam_year',
      'problem_number',
      'tags',
      'solution'
    ];

    const exampleRow = [
      'Sample Math Problem',
      'If x + 2 = 5, what is x?',
      'Practice Problems',
      'Algebra',
      'easy',
      'Mathematics',
      'AMC 8',
      '2023',
      '1',
      'algebra,equations,basic',
      'x = 3'
    ];

    return `${headers.join(',')}\n"${exampleRow.join('","')}"`;
  }

  /**
   * Get import statistics
   */
  async getImportHistory(tenantId: string, limit: number = 10): Promise<any[]> {
    const query = `
      SELECT
        DATE(created_at) as import_date,
        COUNT(*) as problems_imported,
        subject,
        category
      FROM problems
      WHERE tenant_id = $1
      GROUP BY DATE(created_at), subject, category
      ORDER BY DATE(created_at) DESC
      LIMIT $2
    `;

    const result = await db.query(query, [tenantId, limit]);
    return result.rows;
  }
}

export default new BulkImportService();
