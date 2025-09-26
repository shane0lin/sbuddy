import { ProblemMatcherService } from '../../src/services/problemMatcher';
import { OCRResult, Problem } from '../../src/types';
import { v4 as uuidv4 } from 'uuid';

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }))
  };
});

import OpenAI from 'openai';

const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;
const mockedOpenAI = new MockedOpenAI() as jest.Mocked<OpenAI>;

describe('ProblemMatcherService', () => {
  let problemMatcher: ProblemMatcherService;
  const mockTenantId = uuidv4();

  beforeEach(() => {
    problemMatcher = new ProblemMatcherService();
    jest.clearAllMocks();

    // Set test environment variable
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  describe('matchProblemsToDatabase', () => {
    const mockOCRResult: OCRResult = {
      success: true,
      text: 'What is the sum of 2 + 2?',
      confidence: 0.95,
      problems_detected: 1,
      problems: [{
        text: 'What is the sum of 2 + 2?',
        bbox: [10, 20, 100, 50]
      }]
    };

    const mockDatabaseProblems: Problem[] = [
      {
        id: uuidv4(),
        title: 'Basic Addition',
        content: 'What is 2 + 2?',
        source: 'Test',
        category: 'Arithmetic',
        difficulty: 'easy',
        subject: 'Mathematics',
        tenant_id: mockTenantId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        title: 'Algebra Problem',
        content: 'Solve for x: 2x + 3 = 7',
        source: 'Test',
        category: 'Algebra',
        difficulty: 'medium',
        subject: 'Mathematics',
        tenant_id: mockTenantId,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    it('should successfully match OCR problems to database problems', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([{
              ocr_problem_index: 0,
              matched_problem_id: mockDatabaseProblems[0].id,
              confidence_score: 0.92,
              reasoning: 'Both problems ask for the sum of 2 + 2, which is identical content'
            }])
          }
        }]
      };

      mockedOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await problemMatcher.matchProblemsToDatabase(
        mockOCRResult,
        mockDatabaseProblems,
        mockTenantId
      );

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].matched_problem_id).toBe(mockDatabaseProblems[0].id);
      expect(result.matches[0].confidence_score).toBe(0.92);
      expect(result.unmatched_problems).toHaveLength(0);
    });

    it('should handle problems with no matches', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([])
          }
        }]
      };

      mockedOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await problemMatcher.matchProblemsToDatabase(
        mockOCRResult,
        mockDatabaseProblems,
        mockTenantId
      );

      expect(result.matches).toHaveLength(0);
      expect(result.unmatched_problems).toHaveLength(1);
      expect(result.unmatched_problems[0].text).toBe('What is the sum of 2 + 2?');
    });

    it('should handle OpenAI API errors gracefully', async () => {
      mockedOpenAI.chat.completions.create.mockRejectedValue(
        new Error('OpenAI API error')
      );

      const result = await problemMatcher.matchProblemsToDatabase(
        mockOCRResult,
        mockDatabaseProblems,
        mockTenantId
      );

      expect(result.matches).toHaveLength(0);
      expect(result.unmatched_problems).toHaveLength(1);
      expect(result.error).toBe('OpenAI API error');
    });

    it('should filter out low confidence matches', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([{
              ocr_problem_index: 0,
              matched_problem_id: mockDatabaseProblems[0].id,
              confidence_score: 0.3, // Low confidence
              reasoning: 'Weak match'
            }])
          }
        }]
      };

      mockedOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await problemMatcher.matchProblemsToDatabase(
        mockOCRResult,
        mockDatabaseProblems,
        mockTenantId,
        0.5 // Min confidence threshold
      );

      expect(result.matches).toHaveLength(0);
      expect(result.unmatched_problems).toHaveLength(1);
    });

    it('should handle invalid JSON response from OpenAI', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }]
      };

      mockedOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await problemMatcher.matchProblemsToDatabase(
        mockOCRResult,
        mockDatabaseProblems,
        mockTenantId
      );

      expect(result.matches).toHaveLength(0);
      expect(result.unmatched_problems).toHaveLength(1);
      expect(result.error).toContain('Failed to parse');
    });

    it('should handle multiple OCR problems', async () => {
      const multiProblemOCR: OCRResult = {
        success: true,
        text: '1. What is 2 + 2? 2. What is 3 + 3?',
        confidence: 0.9,
        problems_detected: 2,
        problems: [
          { text: 'What is 2 + 2?', bbox: [10, 20, 100, 50] },
          { text: 'What is 3 + 3?', bbox: [10, 60, 100, 90] }
        ]
      };

      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([
              {
                ocr_problem_index: 0,
                matched_problem_id: mockDatabaseProblems[0].id,
                confidence_score: 0.9,
                reasoning: 'Perfect match for addition problem'
              }
            ])
          }
        }]
      };

      mockedOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await problemMatcher.matchProblemsToDatabase(
        multiProblemOCR,
        mockDatabaseProblems,
        mockTenantId
      );

      expect(result.matches).toHaveLength(1);
      expect(result.unmatched_problems).toHaveLength(1);
      expect(result.unmatched_problems[0].text).toBe('What is 3 + 3?');
    });
  });

  describe('generateProblemSuggestions', () => {
    const unmatchedProblem = {
      text: 'Find the derivative of x^2 + 3x + 1',
      bbox: [10, 20, 100, 50]
    };

    it('should generate problem suggestions for unmatched problems', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Derivative of Polynomial',
              category: 'Calculus',
              difficulty: 'medium',
              subject: 'Mathematics',
              suggested_tags: ['derivatives', 'polynomials', 'calculus'],
              explanation: 'This problem asks for the derivative of a polynomial function'
            })
          }
        }]
      };

      mockedOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await problemMatcher.generateProblemSuggestions(
        unmatchedProblem,
        mockTenantId
      );

      expect(result.title).toBe('Derivative of Polynomial');
      expect(result.category).toBe('Calculus');
      expect(result.difficulty).toBe('medium');
      expect(result.suggested_tags).toContain('derivatives');
    });

    it('should handle API errors when generating suggestions', async () => {
      mockedOpenAI.chat.completions.create.mockRejectedValue(
        new Error('API error')
      );

      const result = await problemMatcher.generateProblemSuggestions(
        unmatchedProblem,
        mockTenantId
      );

      expect(result.title).toBe('Unmatched Problem');
      expect(result.category).toBe('General');
      expect(result.difficulty).toBe('medium');
      expect(result.error).toBe('API error');
    });

    it('should handle invalid JSON in suggestion response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Invalid JSON'
          }
        }]
      };

      mockedOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await problemMatcher.generateProblemSuggestions(
        unmatchedProblem,
        mockTenantId
      );

      expect(result.title).toBe('Unmatched Problem');
      expect(result.error).toContain('Failed to parse');
    });
  });

  describe('validateMatchResult', () => {
    it('should validate correct match result structure', () => {
      const validMatch = {
        ocr_problem_index: 0,
        matched_problem_id: uuidv4(),
        confidence_score: 0.8,
        reasoning: 'Good match'
      };

      const result = (problemMatcher as any).validateMatchResult(validMatch);
      expect(result).toBe(true);
    });

    it('should reject invalid match result structure', () => {
      const invalidMatch = {
        ocr_problem_index: 0,
        // missing matched_problem_id
        confidence_score: 0.8,
        reasoning: 'Good match'
      };

      const result = (problemMatcher as any).validateMatchResult(invalidMatch);
      expect(result).toBe(false);
    });

    it('should reject match with invalid confidence score', () => {
      const invalidMatch = {
        ocr_problem_index: 0,
        matched_problem_id: uuidv4(),
        confidence_score: 1.5, // > 1.0
        reasoning: 'Good match'
      };

      const result = (problemMatcher as any).validateMatchResult(invalidMatch);
      expect(result).toBe(false);
    });
  });

  describe('buildMatchingPrompt', () => {
    it('should build proper matching prompt', () => {
      const ocrProblems = [
        { text: 'What is 2 + 2?', bbox: [0, 0, 100, 50] }
      ];
      const dbProblems = [
        {
          id: uuidv4(),
          title: 'Addition',
          content: 'What is 2 + 2?',
          category: 'Math'
        }
      ];

      const prompt = (problemMatcher as any).buildMatchingPrompt(ocrProblems, dbProblems);

      expect(prompt).toContain('What is 2 + 2?');
      expect(prompt).toContain('Addition');
      expect(prompt).toContain('JSON format');
    });
  });

  describe('buildSuggestionPrompt', () => {
    it('should build proper suggestion prompt', () => {
      const unmatchedProblem = {
        text: 'Find the derivative of x^2',
        bbox: [0, 0, 100, 50]
      };

      const prompt = (problemMatcher as any).buildSuggestionPrompt(unmatchedProblem);

      expect(prompt).toContain('Find the derivative of x^2');
      expect(prompt).toContain('title');
      expect(prompt).toContain('category');
      expect(prompt).toContain('difficulty');
    });
  });
});