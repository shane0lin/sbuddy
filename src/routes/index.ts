import { Router } from 'express';
import authController from '../controllers/authController';
import ocrController from '../controllers/ocrController';
import problemController from '../controllers/problemController';
import studySetController from '../controllers/studySetController';
import { authenticateToken, requireSubscription, rateLimiter } from '../middleware/auth';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/profile', authenticateToken, authController.getProfile);
router.put('/auth/profile', authenticateToken, authController.updateProfile);
router.put('/auth/change-password', authenticateToken, authController.changePassword);

// OCR routes (with rate limiting)
router.post('/ocr/process',
  authenticateToken,
  rateLimiter(10, 60000), // 10 requests per minute
  ocrController.uploadMiddleware,
  (req: any, res) => ocrController.processImage(req, res)
);

router.post('/ocr/process-buffer',
  authenticateToken,
  rateLimiter(10, 60000),
  (req: any, res) => ocrController.processImageBuffer(req, res)
);

// New: Enhanced multi-problem detection with AI
router.post('/ocr/process-multi',
  authenticateToken,
  rateLimiter(10, 60000),
  ocrController.uploadMiddleware,
  (req: any, res) => ocrController.processMultipleProblems(req, res)
);

router.get('/ocr/health', ocrController.healthCheck);

// Problem routes
router.post('/problems', authenticateToken, (req: any, res) => problemController.createProblem(req, res));
router.get('/problems/search', authenticateToken, (req: any, res) => problemController.searchProblems(req, res));
router.get('/problems/statistics', authenticateToken, (req: any, res) => problemController.getStatistics(req, res));
router.get('/problems/:id', authenticateToken, (req: any, res) => problemController.getProblem(req, res));
router.put('/problems/:id', authenticateToken, (req: any, res) => problemController.updateProblem(req, res));
router.delete('/problems/:id', authenticateToken, (req: any, res) => problemController.deleteProblem(req, res));
router.post('/problems/:id/answer', authenticateToken, (req: any, res) => problemController.submitAnswer(req, res));
router.post('/problems/:id/study', authenticateToken, (req: any, res) => problemController.addToStudySet(req, res));
router.get('/problems/:id/similar', authenticateToken, (req: any, res) => problemController.getSimilarProblems(req, res));

// Bulk operations (premium feature)
router.post('/problems/bulk-import',
  authenticateToken,
  requireSubscription('premium'),
  (req: any, res) => problemController.bulkImport(req, res)
);

// Enhanced bulk import endpoints
router.post('/problems/import/csv',
  authenticateToken,
  requireSubscription('premium'),
  (req: any, res) => problemController.importCSV(req, res)
);

router.post('/problems/import/json',
  authenticateToken,
  requireSubscription('premium'),
  (req: any, res) => problemController.importJSON(req, res)
);

router.get('/problems/import/template',
  authenticateToken,
  (req: any, res) => problemController.getImportTemplate(req, res)
);

router.get('/problems/import/history',
  authenticateToken,
  (req: any, res) => problemController.getImportHistory(req, res)
);

// Study Sets routes
router.post('/study-sets', authenticateToken, (req: any, res) => studySetController.createStudySet(req, res));
router.get('/study-sets', authenticateToken, (req: any, res) => studySetController.getUserStudySets(req, res));
router.get('/study-sets/public', authenticateToken, (req: any, res) => studySetController.getPublicStudySets(req, res));
router.get('/study-sets/:id', authenticateToken, (req: any, res) => studySetController.getStudySet(req, res));
router.put('/study-sets/:id', authenticateToken, (req: any, res) => studySetController.updateStudySet(req, res));
router.delete('/study-sets/:id', authenticateToken, (req: any, res) => studySetController.deleteStudySet(req, res));
router.get('/study-sets/:id/problems', authenticateToken, (req: any, res) => studySetController.getStudySetProblems(req, res));
router.post('/study-sets/:id/problems', authenticateToken, (req: any, res) => studySetController.addProblem(req, res));
router.delete('/study-sets/:id/problems/:problemId', authenticateToken, (req: any, res) => studySetController.removeProblem(req, res));
router.post('/study-sets/:id/problems/bulk', authenticateToken, (req: any, res) => studySetController.bulkAddProblems(req, res));
router.get('/study-sets/:id/stats', authenticateToken, (req: any, res) => studySetController.getStats(req, res));
router.post('/study-sets/:id/clone', authenticateToken, (req: any, res) => studySetController.cloneStudySet(req, res));

// Study system routes
router.get('/study/due-cards', authenticateToken, async (req: any, res) => {
  try {
    const spacedRepetition = (await import('../services/spacedRepetition')).default;
    const limit = parseInt(req.query.limit as string) || 20;
    const cards = await spacedRepetition.getDueCards(req.user.userId, limit);
    res.json({ due_cards: cards, count: cards.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/study/upcoming', authenticateToken, async (req: any, res) => {
  try {
    const spacedRepetition = (await import('../services/spacedRepetition')).default;
    const days = parseInt(req.query.days as string) || 7;
    const upcoming = await spacedRepetition.getUpcomingReviews(req.user.userId, days);
    res.json({ upcoming_reviews: upcoming });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/study/statistics', authenticateToken, async (req: any, res) => {
  try {
    const spacedRepetition = (await import('../services/spacedRepetition')).default;
    const stats = await spacedRepetition.getUserStatistics(req.user.userId);
    res.json({ statistics: stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/study/bulk-add', authenticateToken, async (req: any, res) => {
  try {
    const spacedRepetition = (await import('../services/spacedRepetition')).default;
    const { problem_ids } = req.body;

    if (!Array.isArray(problem_ids)) {
      res.status(400).json({ error: 'problem_ids must be an array' });
      return;
    }

    const cards = await spacedRepetition.bulkCreateCards(req.user.userId, problem_ids);
    res.json({
      message: `${cards.length} problems added to study set`,
      cards
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Gamification routes
router.get('/gamification/score', authenticateToken, async (req: any, res) => {
  try {
    const gamificationService = (await import('../services/gamificationService')).default;
    const score = await gamificationService.getUserScore(req.user.userId);
    const rank = await gamificationService.getUserRank(req.user.userId);
    res.json({ score, rank });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/gamification/leaderboard', authenticateToken, async (req: any, res) => {
  try {
    const gamificationService = (await import('../services/gamificationService')).default;
    const limit = parseInt(req.query.limit as string) || 10;
    const leaderboard = await gamificationService.getLeaderboard(req.user.tenantId, limit);
    res.json({ leaderboard });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/gamification/daily-challenge', authenticateToken, async (req: any, res) => {
  try {
    const gamificationService = (await import('../services/gamificationService')).default;
    const challenge = await gamificationService.getDailyChallenge(req.user.userId);
    res.json({ challenge: challenge.challenge, progress: challenge.progress, completed: challenge.completed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Payment routes (enterprise feature)
router.get('/payment/status',
  authenticateToken,
  async (req: any, res) => {
    try {
      const paymentService = (await import('../services/paymentService')).default;
      const status = await paymentService.getSubscriptionStatus(req.user.userId);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.post('/payment/create-subscription',
  authenticateToken,
  async (req: any, res) => {
    try {
      const paymentService = (await import('../services/paymentService')).default;
      const { price_id, payment_method_id } = req.body;

      if (!price_id) {
        res.status(400).json({ error: 'price_id is required' });
        return;
      }

      const subscription = await paymentService.createSubscription(
        req.user.userId,
        price_id,
        payment_method_id
      );

      res.json({ subscription });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Webhook for Stripe
router.post('/webhooks/stripe', async (req, res) => {
  try {
    const paymentService = (await import('../services/paymentService')).default;
    const signature = req.headers['stripe-signature'] as string;

    await paymentService.handleWebhook(req.body, signature);
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook handler failed' });
  }
});

export default router;