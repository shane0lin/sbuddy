import { Request, Response } from 'express';
import problemRepository from '../services/problemRepository';
import bulkImportService from '../services/bulkImportService';
import spacedRepetition from '../services/spacedRepetition';
import gamificationService from '../services/gamificationService';
import { AuthRequest } from '../middleware/auth';
import Joi from 'joi';

const createProblemSchema = Joi.object({
  title: Joi.string().required(),
  content: Joi.string().required(),
  source: Joi.string().required(),
  category: Joi.string().required(),
  difficulty: Joi.string().valid('easy', 'medium', 'hard').default('medium'),
  subject: Joi.string().required(),
  exam_type: Joi.string().optional(),
  exam_year: Joi.number().integer().min(1900).max(2100).optional(),
  problem_number: Joi.number().integer().min(1).optional(),
  tags: Joi.array().items(Joi.string()).default([]),
  solution: Joi.string().optional()
});

const searchProblemsSchema = Joi.object({
  subject: Joi.string().optional(),
  category: Joi.string().optional(),
  difficulty: Joi.string().valid('easy', 'medium', 'hard').optional(),
  exam_type: Joi.string().optional(),
  exam_year: Joi.number().integer().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  search: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0)
});

export class ProblemController {
  async createProblem(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { error, value } = createProblemSchema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const problemData = {
        ...value,
        tenant_id: req.user!.tenantId
      };

      const problem = await problemRepository.createProblem(problemData);
      res.status(201).json({
        message: 'Problem created successfully',
        problem
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getProblem(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const problem = await problemRepository.getProblemById(id, req.user!.tenantId);

      if (!problem) {
        res.status(404).json({ error: 'Problem not found' });
        return;
      }

      res.json({ problem });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async searchProblems(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { error, value } = searchProblemsSchema.validate(req.query);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { limit, offset, ...filters } = value;
      const result = await problemRepository.searchProblems(
        req.user!.tenantId,
        filters,
        limit,
        offset
      );

      res.json({
        problems: result.problems,
        total: result.total,
        limit,
        offset,
        has_more: result.total > offset + limit
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateProblem(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateSchema = createProblemSchema.fork(
        ['title', 'content', 'source', 'category', 'subject'],
        (schema) => schema.optional()
      );

      const { error, value } = updateSchema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const updatedProblem = await problemRepository.updateProblem(
        id,
        req.user!.tenantId,
        value
      );

      if (!updatedProblem) {
        res.status(404).json({ error: 'Problem not found' });
        return;
      }

      res.json({
        message: 'Problem updated successfully',
        problem: updatedProblem
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteProblem(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await problemRepository.deleteProblem(id, req.user!.tenantId);

      if (!deleted) {
        res.status(404).json({ error: 'Problem not found' });
        return;
      }

      res.json({ message: 'Problem deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async submitAnswer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const schema = Joi.object({
        answer: Joi.string().required(),
        time_spent: Joi.number().min(0).default(0),
        quality_rating: Joi.number().integer().min(0).max(5).default(3)
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const problem = await problemRepository.getProblemById(id, req.user!.tenantId);
      if (!problem) {
        res.status(404).json({ error: 'Problem not found' });
        return;
      }

      // This is a simplified answer checking - in reality, you'd want more sophisticated checking
      const isCorrect = value.answer.toLowerCase().trim() === (problem.solution || '').toLowerCase().trim();

      // Update spaced repetition
      const card = await spacedRepetition.getCard(req.user!.userId, id);
      if (card) {
        await spacedRepetition.updateCardAfterReview(req.user!.userId, id, value.quality_rating);
      } else {
        await spacedRepetition.createCard(req.user!.userId, id);
      }

      // Update gamification
      const scoreUpdate = await gamificationService.updateScoreAfterProblem(
        req.user!.userId,
        isCorrect,
        problem.difficulty as 'easy' | 'medium' | 'hard',
        value.time_spent
      );

      res.json({
        correct: isCorrect,
        solution: problem.solution,
        score_update: scoreUpdate,
        message: isCorrect ? 'Correct answer!' : 'Incorrect, keep trying!'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async addToStudySet(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const problem = await problemRepository.getProblemById(id, req.user!.tenantId);
      if (!problem) {
        res.status(404).json({ error: 'Problem not found' });
        return;
      }

      await spacedRepetition.createCard(req.user!.userId, id);

      res.json({ message: 'Problem added to study set' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async bulkImport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        problems: Joi.array().items(createProblemSchema.fork(
          ['tenant_id'],
          (schema) => schema.forbidden()
        )).required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const problemsData = value.problems.map((p: any) => ({
        ...p,
        tenant_id: req.user!.tenantId
      }));

      const importedProblems = await problemRepository.bulkImportProblems(problemsData);

      res.status(201).json({
        message: `${importedProblems.length} problems imported successfully`,
        problems: importedProblems
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Import from CSV
   * POST /problems/import/csv
   */
  async importCSV(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { csv_content, validate_only } = req.body;

      if (!csv_content) {
        res.status(400).json({ error: 'csv_content is required' });
        return;
      }

      const result = await bulkImportService.importFromCSV(
        csv_content,
        req.user!.tenantId,
        validate_only || false
      );

      res.status(result.success ? 200 : 400).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Import from JSON
   * POST /problems/import/json
   */
  async importJSON(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { json_content, validate_only } = req.body;

      if (!json_content) {
        res.status(400).json({ error: 'json_content is required' });
        return;
      }

      const jsonString = typeof json_content === 'string'
        ? json_content
        : JSON.stringify(json_content);

      const result = await bulkImportService.importFromJSON(
        jsonString,
        req.user!.tenantId,
        validate_only || false
      );

      res.status(result.success ? 200 : 400).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get CSV template
   * GET /problems/import/template
   */
  async getImportTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const template = bulkImportService.generateCSVTemplate();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="problems_template.csv"');
      res.send(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get import history
   * GET /problems/import/history
   */
  async getImportHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const history = await bulkImportService.getImportHistory(req.user!.tenantId, limit);
      res.json({ history, count: history.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getStatistics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const stats = await problemRepository.getStatistics(req.user!.tenantId);
      res.json({ statistics: stats });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getSimilarProblems(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { limit = 5 } = req.query;

      const problem = await problemRepository.getProblemById(id, req.user!.tenantId);
      if (!problem) {
        res.status(404).json({ error: 'Problem not found' });
        return;
      }

      const similarProblems = await problemRepository.findSimilarProblems(
        problem.content,
        req.user!.tenantId,
        parseInt(limit as string)
      );

      // Filter out the original problem
      const filtered = similarProblems.filter(p => p.id !== id);

      res.json({ similar_problems: filtered });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new ProblemController();