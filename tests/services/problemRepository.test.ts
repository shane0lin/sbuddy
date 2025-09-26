import { ProblemRepositoryService } from '../../src/services/problemRepository';
import { Problem } from '../../src/types';
import { v4 as uuidv4 } from 'uuid';

// Mock the database module
jest.mock('../../src/models/database', () => ({
  db: {
    query: jest.fn(),
    connect: jest.fn(() => ({
      query: jest.fn(),
      release: jest.fn()
    }))
  }
}));

import { db } from '../../src/models/database';

const mockedDb = db as jest.Mocked<typeof db>;

describe('ProblemRepositoryService', () => {
  let problemRepository: ProblemRepositoryService;
  const mockTenantId = uuidv4();
  const mockProblemId = uuidv4();

  beforeEach(() => {
    problemRepository = new ProblemRepositoryService();
    jest.clearAllMocks();
  });

  describe('createProblem', () => {
    const mockProblemData = {
      title: 'Test Problem',
      content: 'What is 2 + 2?',
      source: 'Test Source',
      category: 'Math',
      difficulty: 'easy' as const,
      subject: 'Mathematics',
      exam_type: 'AMC10',
      exam_year: 2024,
      problem_number: 1,
      tags: ['test', 'math'],
      solution: 'The answer is 4',
      tenant_id: mockTenantId
    };

    it('should create a problem successfully', async () => {
      const mockCreatedProblem = {
        id: mockProblemId,
        ...mockProblemData,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockedDb.query.mockResolvedValue({
        rows: [mockCreatedProblem],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      });

      const result = await problemRepository.createProblem(mockProblemData);

      expect(result).toEqual(mockCreatedProblem);
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO problems'),
        expect.arrayContaining([
          expect.any(String), // UUID
          mockProblemData.title,
          mockProblemData.content,
          mockProblemData.source,
          mockProblemData.category,
          mockProblemData.difficulty,
          mockProblemData.subject,
          mockProblemData.exam_type,
          mockProblemData.exam_year,
          mockProblemData.problem_number,
          mockProblemData.tags,
          mockProblemData.solution,
          mockProblemData.tenant_id
        ])
      );
    });

    it('should handle database errors', async () => {
      mockedDb.query.mockRejectedValue(new Error('Database error'));

      await expect(problemRepository.createProblem(mockProblemData))
        .rejects.toThrow('Database error');
    });
  });

  describe('getProblemById', () => {
    it('should return a problem when found', async () => {
      const mockProblem = {
        id: mockProblemId,
        title: 'Test Problem',
        content: 'Test content',
        tenant_id: mockTenantId
      };

      mockedDb.query.mockResolvedValue({
        rows: [mockProblem],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await problemRepository.getProblemById(mockProblemId, mockTenantId);

      expect(result).toEqual(mockProblem);
      expect(mockedDb.query).toHaveBeenCalledWith(
        'SELECT * FROM problems WHERE id = $1 AND tenant_id = $2',
        [mockProblemId, mockTenantId]
      );
    });

    it('should return null when problem not found', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await problemRepository.getProblemById(mockProblemId, mockTenantId);

      expect(result).toBeNull();
    });
  });

  describe('searchProblems', () => {
    const mockProblems = [
      {
        id: uuidv4(),
        title: 'Problem 1',
        subject: 'Mathematics',
        category: 'Algebra',
        difficulty: 'easy'
      },
      {
        id: uuidv4(),
        title: 'Problem 2',
        subject: 'Mathematics',
        category: 'Geometry',
        difficulty: 'medium'
      }
    ];

    it('should search problems with filters', async () => {
      const countResult = { rows: [{ count: '2' }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] };
      const problemsResult = { rows: mockProblems, rowCount: 2, command: 'SELECT', oid: 0, fields: [] };

      mockedDb.query
        .mockResolvedValueOnce(problemsResult)
        .mockResolvedValueOnce(countResult);

      const filters = {
        subject: 'Mathematics',
        difficulty: 'easy'
      };

      const result = await problemRepository.searchProblems(mockTenantId, filters, 10, 0);

      expect(result.problems).toEqual(mockProblems);
      expect(result.total).toBe(2);
    });

    it('should handle search with multiple filters', async () => {
      const filters = {
        subject: 'Mathematics',
        category: 'Algebra',
        difficulty: 'medium',
        examType: 'AMC10',
        examYear: 2024,
        tags: ['competition'],
        search: 'quadratic'
      };

      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      await problemRepository.searchProblems(mockTenantId, filters);

      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1'),
        expect.arrayContaining([mockTenantId])
      );
    });

    it('should handle pagination correctly', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      await problemRepository.searchProblems(mockTenantId, {}, 20, 40);

      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([20, 40])
      );
    });
  });

  describe('findSimilarProblems', () => {
    it('should find similar problems using full-text search', async () => {
      const mockSimilarProblems = [
        {
          id: uuidv4(),
          title: 'Similar Problem 1',
          content: 'What is x + y?',
          rank: 0.8
        }
      ];

      mockedDb.query.mockResolvedValue({
        rows: mockSimilarProblems,
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await problemRepository.findSimilarProblems(
        'algebra equation',
        mockTenantId,
        5
      );

      expect(result).toEqual(mockSimilarProblems);
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ts_rank'),
        ['algebra equation', mockTenantId, 5]
      );
    });
  });

  describe('updateProblem', () => {
    it('should update a problem successfully', async () => {
      const updates = {
        title: 'Updated Title',
        difficulty: 'hard' as const
      };

      const mockUpdatedProblem = {
        id: mockProblemId,
        ...updates,
        updated_at: new Date()
      };

      mockedDb.query.mockResolvedValue({
        rows: [mockUpdatedProblem],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      });

      const result = await problemRepository.updateProblem(mockProblemId, mockTenantId, updates);

      expect(result).toEqual(mockUpdatedProblem);
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE problems'),
        [mockProblemId, mockTenantId, updates.title, updates.difficulty]
      );
    });

    it('should return null when problem not found for update', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'UPDATE',
        oid: 0,
        fields: []
      });

      const result = await problemRepository.updateProblem(mockProblemId, mockTenantId, {
        title: 'New Title'
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteProblem', () => {
    it('should delete a problem successfully', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 1,
        command: 'DELETE',
        oid: 0,
        fields: []
      });

      const result = await problemRepository.deleteProblem(mockProblemId, mockTenantId);

      expect(result).toBe(true);
      expect(mockedDb.query).toHaveBeenCalledWith(
        'DELETE FROM problems WHERE id = $1 AND tenant_id = $2',
        [mockProblemId, mockTenantId]
      );
    });

    it('should return false when problem not found for deletion', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'DELETE',
        oid: 0,
        fields: []
      });

      const result = await problemRepository.deleteProblem(mockProblemId, mockTenantId);

      expect(result).toBe(false);
    });
  });

  describe('getStatistics', () => {
    it('should return problem statistics', async () => {
      const mockStats = {
        total_problems: '150',
        subjects_count: '5',
        categories_count: '10',
        exam_types_count: '3'
      };

      mockedDb.query.mockResolvedValue({
        rows: [mockStats],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await problemRepository.getStatistics(mockTenantId);

      expect(result).toEqual(mockStats);
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) as total_problems'),
        [mockTenantId]
      );
    });
  });

  describe('bulkImportProblems', () => {
    it('should import multiple problems in a transaction', async () => {
      const mockProblems = [
        {
          title: 'Problem 1',
          content: 'Content 1',
          source: 'Source 1',
          category: 'Category 1',
          difficulty: 'easy' as const,
          subject: 'Math',
          tenant_id: mockTenantId
        },
        {
          title: 'Problem 2',
          content: 'Content 2',
          source: 'Source 2',
          category: 'Category 2',
          difficulty: 'medium' as const,
          subject: 'Math',
          tenant_id: mockTenantId
        }
      ];

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ command: 'BEGIN' })
          .mockResolvedValue({
            rows: [{ id: uuidv4(), ...mockProblems[0] }],
            rowCount: 1,
            command: 'INSERT',
            oid: 0,
            fields: []
          })
          .mockResolvedValue({
            rows: [{ id: uuidv4(), ...mockProblems[1] }],
            rowCount: 1,
            command: 'INSERT',
            oid: 0,
            fields: []
          })
          .mockResolvedValueOnce({ command: 'COMMIT' }),
        release: jest.fn()
      };

      mockedDb.connect.mockResolvedValue(mockClient as any);

      const result = await problemRepository.bulkImportProblems(mockProblems);

      expect(result).toHaveLength(2);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const mockProblems = [
        {
          title: 'Problem 1',
          content: 'Content 1',
          source: 'Source 1',
          category: 'Category 1',
          difficulty: 'easy' as const,
          subject: 'Math',
          tenant_id: mockTenantId
        }
      ];

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ command: 'BEGIN' })
          .mockRejectedValueOnce(new Error('Insert failed'))
          .mockResolvedValueOnce({ command: 'ROLLBACK' }),
        release: jest.fn()
      };

      mockedDb.connect.mockResolvedValue(mockClient as any);

      await expect(problemRepository.bulkImportProblems(mockProblems))
        .rejects.toThrow('Insert failed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});