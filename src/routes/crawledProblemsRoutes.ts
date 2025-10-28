import { Router } from 'express';
import crawledProblemsController from '../controllers/crawledProblemsController';

const router = Router();

/**
 * Crawled Problems Routes
 * Public read-only access to crawled AMC problems
 */

// Get list of all available tests
router.get('/tests', crawledProblemsController.getTests.bind(crawledProblemsController));

// Get index (amc_index.json equivalent)
router.get('/index', crawledProblemsController.getIndex.bind(crawledProblemsController));

// Get all problems for a specific test
router.get('/tests/:year/:variant', crawledProblemsController.getTestProblems.bind(crawledProblemsController));

// Search problems
router.get('/search', crawledProblemsController.searchProblems.bind(crawledProblemsController));

// Get single problem by ID
router.get('/problems/:id', crawledProblemsController.getProblem.bind(crawledProblemsController));

export default router;
