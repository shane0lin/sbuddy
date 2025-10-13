import { db } from '../models/database';
import { StudySet, StudySetProblem, Problem } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class StudySetService {
  /**
   * Create a new study set
   */
  async createStudySet(
    userId: string,
    name: string,
    description?: string,
    isPublic: boolean = false,
    tags: string[] = []
  ): Promise<StudySet> {
    const query = `
      INSERT INTO study_sets (id, user_id, name, description, is_public, tags)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [uuidv4(), userId, name, description || null, isPublic, tags];
    const result = await db.query(query, values);

    return result.rows[0];
  }

  /**
   * Get a study set by ID
   */
  async getStudySet(studySetId: string, userId: string): Promise<StudySet | null> {
    const query = `
      SELECT * FROM study_sets
      WHERE id = $1 AND (user_id = $2 OR is_public = TRUE)
    `;

    const result = await db.query(query, [studySetId, userId]);
    return result.rows[0] || null;
  }

  /**
   * Get all study sets for a user
   */
  async getUserStudySets(userId: string): Promise<StudySet[]> {
    const query = `
      SELECT * FROM study_sets
      WHERE user_id = $1
      ORDER BY updated_at DESC
    `;

    const result = await db.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get public study sets
   */
  async getPublicStudySets(limit: number = 50, offset: number = 0): Promise<StudySet[]> {
    const query = `
      SELECT ss.*, u.email as creator_email
      FROM study_sets ss
      JOIN users u ON ss.user_id = u.id
      WHERE ss.is_public = TRUE
      ORDER BY ss.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);
    return result.rows;
  }

  /**
   * Update a study set
   */
  async updateStudySet(
    studySetId: string,
    userId: string,
    updates: {
      name?: string;
      description?: string;
      is_public?: boolean;
      tags?: string[];
    }
  ): Promise<StudySet | null> {
    // Check ownership
    const ownership = await db.query(
      'SELECT id FROM study_sets WHERE id = $1 AND user_id = $2',
      [studySetId, userId]
    );

    if (ownership.rows.length === 0) {
      throw new Error('Study set not found or access denied');
    }

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      values.push(updates.description);
    }

    if (updates.is_public !== undefined) {
      updateFields.push(`is_public = $${paramCount++}`);
      values.push(updates.is_public);
    }

    if (updates.tags !== undefined) {
      updateFields.push(`tags = $${paramCount++}`);
      values.push(updates.tags);
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(studySetId);
    values.push(userId);

    const query = `
      UPDATE study_sets
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete a study set
   */
  async deleteStudySet(studySetId: string, userId: string): Promise<boolean> {
    const query = `
      DELETE FROM study_sets
      WHERE id = $1 AND user_id = $2
    `;

    const result = await db.query(query, [studySetId, userId]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Add a problem to a study set
   */
  async addProblemToSet(
    studySetId: string,
    problemId: string,
    userId: string,
    customNotes?: string
  ): Promise<StudySetProblem> {
    // Check ownership
    const ownership = await db.query(
      'SELECT id FROM study_sets WHERE id = $1 AND user_id = $2',
      [studySetId, userId]
    );

    if (ownership.rows.length === 0) {
      throw new Error('Study set not found or access denied');
    }

    // Check if problem exists
    const problemCheck = await db.query('SELECT id FROM problems WHERE id = $1', [problemId]);
    if (problemCheck.rows.length === 0) {
      throw new Error('Problem not found');
    }

    const query = `
      INSERT INTO study_set_problems (id, study_set_id, problem_id, custom_notes)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (study_set_id, problem_id)
      DO UPDATE SET custom_notes = $4, added_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [uuidv4(), studySetId, problemId, customNotes || null];
    const result = await db.query(query, values);

    // Update study set's updated_at timestamp
    await db.query(
      'UPDATE study_sets SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [studySetId]
    );

    return result.rows[0];
  }

  /**
   * Remove a problem from a study set
   */
  async removeProblemFromSet(
    studySetId: string,
    problemId: string,
    userId: string
  ): Promise<boolean> {
    // Check ownership
    const ownership = await db.query(
      'SELECT id FROM study_sets WHERE id = $1 AND user_id = $2',
      [studySetId, userId]
    );

    if (ownership.rows.length === 0) {
      throw new Error('Study set not found or access denied');
    }

    const query = `
      DELETE FROM study_set_problems
      WHERE study_set_id = $1 AND problem_id = $2
    `;

    const result = await db.query(query, [studySetId, problemId]);

    // Update study set's updated_at timestamp
    await db.query(
      'UPDATE study_sets SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [studySetId]
    );

    return (result.rowCount || 0) > 0;
  }

  /**
   * Get all problems in a study set with full problem details
   */
  async getStudySetProblems(studySetId: string, userId: string): Promise<Array<Problem & { custom_notes?: string; added_at: Date }>> {
    // Check access (owner or public)
    const accessCheck = await db.query(
      'SELECT id FROM study_sets WHERE id = $1 AND (user_id = $2 OR is_public = TRUE)',
      [studySetId, userId]
    );

    if (accessCheck.rows.length === 0) {
      throw new Error('Study set not found or access denied');
    }

    const query = `
      SELECT
        p.*,
        ssp.custom_notes,
        ssp.added_at
      FROM study_set_problems ssp
      JOIN problems p ON ssp.problem_id = p.id
      WHERE ssp.study_set_id = $1
      ORDER BY ssp.added_at DESC
    `;

    const result = await db.query(query, [studySetId]);
    return result.rows;
  }

  /**
   * Bulk add problems to a study set
   */
  async bulkAddProblems(
    studySetId: string,
    problemIds: string[],
    userId: string
  ): Promise<{ added: number; skipped: number }> {
    // Check ownership
    const ownership = await db.query(
      'SELECT id FROM study_sets WHERE id = $1 AND user_id = $2',
      [studySetId, userId]
    );

    if (ownership.rows.length === 0) {
      throw new Error('Study set not found or access denied');
    }

    let added = 0;
    let skipped = 0;

    for (const problemId of problemIds) {
      try {
        const query = `
          INSERT INTO study_set_problems (id, study_set_id, problem_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (study_set_id, problem_id) DO NOTHING
          RETURNING id
        `;

        const result = await db.query(query, [uuidv4(), studySetId, problemId]);

        if (result.rows.length > 0) {
          added++;
        } else {
          skipped++;
        }
      } catch (error) {
        skipped++;
        console.error(`Error adding problem ${problemId}:`, error);
      }
    }

    // Update study set's updated_at timestamp
    if (added > 0) {
      await db.query(
        'UPDATE study_sets SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [studySetId]
      );
    }

    return { added, skipped };
  }

  /**
   * Get study set statistics
   */
  async getStudySetStats(studySetId: string, userId: string): Promise<{
    total_problems: number;
    by_difficulty: { easy: number; medium: number; hard: number };
    by_subject: Record<string, number>;
    avg_difficulty_rating: number;
  }> {
    // Check access
    const accessCheck = await db.query(
      'SELECT id FROM study_sets WHERE id = $1 AND (user_id = $2 OR is_public = TRUE)',
      [studySetId, userId]
    );

    if (accessCheck.rows.length === 0) {
      throw new Error('Study set not found or access denied');
    }

    const query = `
      SELECT
        COUNT(*) as total_problems,
        COUNT(CASE WHEN p.difficulty = 'easy' THEN 1 END) as easy_count,
        COUNT(CASE WHEN p.difficulty = 'medium' THEN 1 END) as medium_count,
        COUNT(CASE WHEN p.difficulty = 'hard' THEN 1 END) as hard_count,
        p.subject,
        COUNT(*) as subject_count
      FROM study_set_problems ssp
      JOIN problems p ON ssp.problem_id = p.id
      WHERE ssp.study_set_id = $1
      GROUP BY p.subject
    `;

    const result = await db.query(query, [studySetId]);

    const stats = {
      total_problems: 0,
      by_difficulty: { easy: 0, medium: 0, hard: 0 },
      by_subject: {} as Record<string, number>,
      avg_difficulty_rating: 0
    };

    if (result.rows.length > 0) {
      stats.total_problems = parseInt(result.rows[0].total_problems) || 0;
      stats.by_difficulty.easy = parseInt(result.rows[0].easy_count) || 0;
      stats.by_difficulty.medium = parseInt(result.rows[0].medium_count) || 0;
      stats.by_difficulty.hard = parseInt(result.rows[0].hard_count) || 0;

      result.rows.forEach(row => {
        if (row.subject) {
          stats.by_subject[row.subject] = parseInt(row.subject_count);
        }
      });
    }

    return stats;
  }

  /**
   * Clone/duplicate a study set
   */
  async cloneStudySet(
    studySetId: string,
    userId: string,
    newName: string
  ): Promise<StudySet> {
    // Get original study set (must be accessible)
    const original = await this.getStudySet(studySetId, userId);
    if (!original) {
      throw new Error('Study set not found or access denied');
    }

    // Create new study set
    const newSet = await this.createStudySet(
      userId,
      newName,
      `Cloned from: ${original.name}`,
      false,
      original.tags
    );

    // Copy all problems
    const problems = await this.getStudySetProblems(studySetId, userId);
    const problemIds = problems.map(p => p.id);

    if (problemIds.length > 0) {
      await this.bulkAddProblems(newSet.id, problemIds, userId);
    }

    return newSet;
  }
}

export default new StudySetService();
