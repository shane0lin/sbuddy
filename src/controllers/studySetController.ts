import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import studySetService from '../services/studySetService';

export class StudySetController {
  /**
   * Create a new study set
   * POST /api/v1/study-sets
   */
  async createStudySet(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, description, is_public, tags } = req.body;

      if (!name || name.trim().length === 0) {
        res.status(400).json({ error: 'Study set name is required' });
        return;
      }

      const studySet = await studySetService.createStudySet(
        req.user!.userId,
        name.trim(),
        description,
        is_public || false,
        tags || []
      );

      res.status(201).json({
        message: 'Study set created successfully',
        study_set: studySet
      });
    } catch (error: any) {
      console.error('Error creating study set:', error);
      res.status(500).json({ error: 'Failed to create study set' });
    }
  }

  /**
   * Get a specific study set
   * GET /api/v1/study-sets/:id
   */
  async getStudySet(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const studySet = await studySetService.getStudySet(id, req.user!.userId);

      if (!studySet) {
        res.status(404).json({ error: 'Study set not found' });
        return;
      }

      res.json({ study_set: studySet });
    } catch (error: any) {
      console.error('Error getting study set:', error);
      res.status(500).json({ error: 'Failed to get study set' });
    }
  }

  /**
   * Get all study sets for the authenticated user
   * GET /api/v1/study-sets
   */
  async getUserStudySets(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studySets = await studySetService.getUserStudySets(req.user!.userId);

      res.json({
        study_sets: studySets,
        count: studySets.length
      });
    } catch (error: any) {
      console.error('Error getting user study sets:', error);
      res.status(500).json({ error: 'Failed to get study sets' });
    }
  }

  /**
   * Get public study sets
   * GET /api/v1/study-sets/public
   */
  async getPublicStudySets(req: AuthRequest, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const studySets = await studySetService.getPublicStudySets(limit, offset);

      res.json({
        study_sets: studySets,
        count: studySets.length,
        limit,
        offset
      });
    } catch (error: any) {
      console.error('Error getting public study sets:', error);
      res.status(500).json({ error: 'Failed to get public study sets' });
    }
  }

  /**
   * Update a study set
   * PUT /api/v1/study-sets/:id
   */
  async updateStudySet(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, description, is_public, tags } = req.body;

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (is_public !== undefined) updates.is_public = is_public;
      if (tags !== undefined) updates.tags = tags;

      const studySet = await studySetService.updateStudySet(
        id,
        req.user!.userId,
        updates
      );

      if (!studySet) {
        res.status(404).json({ error: 'Study set not found' });
        return;
      }

      res.json({
        message: 'Study set updated successfully',
        study_set: studySet
      });
    } catch (error: any) {
      console.error('Error updating study set:', error);
      res.status(500).json({ error: error.message || 'Failed to update study set' });
    }
  }

  /**
   * Delete a study set
   * DELETE /api/v1/study-sets/:id
   */
  async deleteStudySet(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const deleted = await studySetService.deleteStudySet(id, req.user!.userId);

      if (!deleted) {
        res.status(404).json({ error: 'Study set not found' });
        return;
      }

      res.json({ message: 'Study set deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting study set:', error);
      res.status(500).json({ error: 'Failed to delete study set' });
    }
  }

  /**
   * Get problems in a study set
   * GET /api/v1/study-sets/:id/problems
   */
  async getStudySetProblems(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const problems = await studySetService.getStudySetProblems(id, req.user!.userId);

      res.json({
        problems,
        count: problems.length
      });
    } catch (error: any) {
      console.error('Error getting study set problems:', error);
      res.status(500).json({ error: error.message || 'Failed to get study set problems' });
    }
  }

  /**
   * Add a problem to a study set
   * POST /api/v1/study-sets/:id/problems
   */
  async addProblem(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { problem_id, custom_notes } = req.body;

      if (!problem_id) {
        res.status(400).json({ error: 'problem_id is required' });
        return;
      }

      const studySetProblem = await studySetService.addProblemToSet(
        id,
        problem_id,
        req.user!.userId,
        custom_notes
      );

      res.status(201).json({
        message: 'Problem added to study set',
        study_set_problem: studySetProblem
      });
    } catch (error: any) {
      console.error('Error adding problem to study set:', error);
      res.status(500).json({ error: error.message || 'Failed to add problem to study set' });
    }
  }

  /**
   * Remove a problem from a study set
   * DELETE /api/v1/study-sets/:id/problems/:problemId
   */
  async removeProblem(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id, problemId } = req.params;

      const removed = await studySetService.removeProblemFromSet(
        id,
        problemId,
        req.user!.userId
      );

      if (!removed) {
        res.status(404).json({ error: 'Problem not found in study set' });
        return;
      }

      res.json({ message: 'Problem removed from study set' });
    } catch (error: any) {
      console.error('Error removing problem from study set:', error);
      res.status(500).json({ error: error.message || 'Failed to remove problem from study set' });
    }
  }

  /**
   * Bulk add problems to a study set
   * POST /api/v1/study-sets/:id/problems/bulk
   */
  async bulkAddProblems(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { problem_ids } = req.body;

      if (!Array.isArray(problem_ids) || problem_ids.length === 0) {
        res.status(400).json({ error: 'problem_ids must be a non-empty array' });
        return;
      }

      const result = await studySetService.bulkAddProblems(
        id,
        problem_ids,
        req.user!.userId
      );

      res.json({
        message: `Bulk add completed: ${result.added} added, ${result.skipped} skipped`,
        added: result.added,
        skipped: result.skipped
      });
    } catch (error: any) {
      console.error('Error bulk adding problems:', error);
      res.status(500).json({ error: error.message || 'Failed to bulk add problems' });
    }
  }

  /**
   * Get study set statistics
   * GET /api/v1/study-sets/:id/stats
   */
  async getStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const stats = await studySetService.getStudySetStats(id, req.user!.userId);

      res.json({ statistics: stats });
    } catch (error: any) {
      console.error('Error getting study set stats:', error);
      res.status(500).json({ error: error.message || 'Failed to get study set statistics' });
    }
  }

  /**
   * Clone a study set
   * POST /api/v1/study-sets/:id/clone
   */
  async cloneStudySet(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name } = req.body;

      if (!name || name.trim().length === 0) {
        res.status(400).json({ error: 'New study set name is required' });
        return;
      }

      const clonedSet = await studySetService.cloneStudySet(
        id,
        req.user!.userId,
        name.trim()
      );

      res.status(201).json({
        message: 'Study set cloned successfully',
        study_set: clonedSet
      });
    } catch (error: any) {
      console.error('Error cloning study set:', error);
      res.status(500).json({ error: error.message || 'Failed to clone study set' });
    }
  }
}

export default new StudySetController();
