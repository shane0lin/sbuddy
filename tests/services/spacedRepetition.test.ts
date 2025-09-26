import { SpacedRepetitionService } from '../../src/services/spacedRepetition';
import { v4 as uuidv4 } from 'uuid';

// Mock database
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

describe('SpacedRepetitionService', () => {
  let spacedRepetitionService: SpacedRepetitionService;
  const mockUserId = uuidv4();
  const mockProblemId = uuidv4();
  const mockCardId = uuidv4();

  beforeEach(() => {
    spacedRepetitionService = new SpacedRepetitionService();
    jest.clearAllMocks();
  });

  describe('createCard', () => {
    it('should create a new spaced repetition card', async () => {
      const mockCard = {
        id: mockCardId,
        user_id: mockUserId,
        problem_id: mockProblemId,
        interval: 1,
        repetitions: 0,
        easiness: 2.5,
        next_review: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      mockedDb.query.mockResolvedValue({
        rows: [mockCard],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      });

      const result = await spacedRepetitionService.createCard(mockUserId, mockProblemId);

      expect(result).toEqual(mockCard);
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO spaced_repetition_cards'),
        expect.arrayContaining([
          expect.any(String), // UUID
          mockUserId,
          mockProblemId,
          1, // initial interval
          0, // initial repetitions
          2.5, // initial easiness
          expect.any(Date) // next review date
        ])
      );
    });

    it('should handle conflict when card already exists', async () => {
      const existingCard = {
        id: mockCardId,
        user_id: mockUserId,
        problem_id: mockProblemId,
        interval: 3,
        repetitions: 2,
        easiness: 2.7
      };

      mockedDb.query.mockResolvedValue({
        rows: [existingCard],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      });

      const result = await spacedRepetitionService.createCard(mockUserId, mockProblemId);

      expect(result).toEqual(existingCard);
    });
  });

  describe('updateCardAfterReview', () => {
    beforeEach(() => {
      // Mock getCard method
      jest.spyOn(spacedRepetitionService, 'getCard').mockResolvedValue({
        user_id: mockUserId,
        problem_id: mockProblemId,
        interval: 1,
        repetitions: 0,
        easiness: 2.5,
        next_review: new Date()
      });
    });

    it('should update card with correct review (quality >= 3)', async () => {
      const mockUpdatedCard = {
        user_id: mockUserId,
        problem_id: mockProblemId,
        interval: 1, // first repetition
        repetitions: 1,
        easiness: 2.6, // slightly increased
        next_review: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      mockedDb.query.mockResolvedValue({
        rows: [mockUpdatedCard],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      });

      const result = await spacedRepetitionService.updateCardAfterReview(
        mockUserId,
        mockProblemId,
        4 // good quality
      );

      expect(result).toEqual(mockUpdatedCard);
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE spaced_repetition_cards'),
        [1, 1, expect.any(Number), expect.any(Date), mockUserId, mockProblemId]
      );
    });

    it('should reset card with incorrect review (quality < 3)', async () => {
      const mockResetCard = {
        user_id: mockUserId,
        problem_id: mockProblemId,
        interval: 1, // reset to 1
        repetitions: 0, // reset to 0
        easiness: expect.any(Number), // adjusted easiness
        next_review: expect.any(Date)
      };

      mockedDb.query.mockResolvedValue({
        rows: [mockResetCard],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      });

      const result = await spacedRepetitionService.updateCardAfterReview(
        mockUserId,
        mockProblemId,
        1 // poor quality
      );

      expect(result.repetitions).toBe(0);
      expect(result.interval).toBe(1);
    });

    it('should calculate increasing intervals for subsequent reviews', async () => {
      // Mock card with existing repetitions
      jest.spyOn(spacedRepetitionService, 'getCard').mockResolvedValue({
        user_id: mockUserId,
        problem_id: mockProblemId,
        interval: 6,
        repetitions: 2,
        easiness: 2.5,
        next_review: new Date()
      });

      const mockUpdatedCard = {
        interval: 15, // 6 * 2.5
        repetitions: 3,
        easiness: 2.6
      };

      mockedDb.query.mockResolvedValue({
        rows: [mockUpdatedCard],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      });

      const result = await spacedRepetitionService.updateCardAfterReview(
        mockUserId,
        mockProblemId,
        4
      );

      expect(result.interval).toBeGreaterThan(6);
      expect(result.repetitions).toBe(3);
    });

    it('should throw error if card not found', async () => {
      jest.spyOn(spacedRepetitionService, 'getCard').mockResolvedValue(null);

      await expect(
        spacedRepetitionService.updateCardAfterReview(mockUserId, mockProblemId, 4)
      ).rejects.toThrow('Card not found');
    });
  });

  describe('getCard', () => {
    it('should return existing card', async () => {
      const mockCard = {
        user_id: mockUserId,
        problem_id: mockProblemId,
        interval: 3,
        repetitions: 1,
        easiness: 2.6
      };

      mockedDb.query.mockResolvedValue({
        rows: [mockCard],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await spacedRepetitionService.getCard(mockUserId, mockProblemId);

      expect(result).toEqual(mockCard);
      expect(mockedDb.query).toHaveBeenCalledWith(
        'SELECT * FROM spaced_repetition_cards WHERE user_id = $1 AND problem_id = $2',
        [mockUserId, mockProblemId]
      );
    });

    it('should return null if card not found', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await spacedRepetitionService.getCard(mockUserId, mockProblemId);

      expect(result).toBeNull();
    });
  });

  describe('getDueCards', () => {
    it('should return cards due for review', async () => {
      const mockDueCards = [
        {
          user_id: mockUserId,
          problem_id: uuidv4(),
          title: 'Problem 1',
          content: 'What is 2+2?',
          next_review: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
        },
        {
          user_id: mockUserId,
          problem_id: uuidv4(),
          title: 'Problem 2',
          content: 'What is 3+3?',
          next_review: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
        }
      ];

      mockedDb.query.mockResolvedValue({
        rows: mockDueCards,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await spacedRepetitionService.getDueCards(mockUserId, 20);

      expect(result).toEqual(mockDueCards);
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE src.user_id = $1 AND src.next_review <= CURRENT_TIMESTAMP'),
        [mockUserId, 20]
      );
    });

    it('should limit results correctly', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      await spacedRepetitionService.getDueCards(mockUserId, 5);

      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        [mockUserId, 5]
      );
    });
  });

  describe('getUpcomingReviews', () => {
    it('should return upcoming reviews grouped by date', async () => {
      const mockUpcomingReviews = [
        {
          review_date: new Date('2024-01-01'),
          count: '3',
          cards: [{}, {}, {}]
        },
        {
          review_date: new Date('2024-01-02'),
          count: '2',
          cards: [{}, {}]
        }
      ];

      mockedDb.query.mockResolvedValue({
        rows: mockUpcomingReviews,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await spacedRepetitionService.getUpcomingReviews(mockUserId, 7);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2024-01-01',
        count: 3,
        cards: [{}, {}, {}]
      });
      expect(result[1]).toEqual({
        date: '2024-01-02',
        count: 2,
        cards: [{}, {}]
      });
    });

    it('should handle custom day range', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      await spacedRepetitionService.getUpcomingReviews(mockUserId, 14);

      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '14 days'"),
        [mockUserId]
      );
    });
  });

  describe('getUserStatistics', () => {
    it('should return user statistics', async () => {
      const mockStats = {
        total_cards: '25',
        due_today: '5',
        mastered: '10',
        learning: '15',
        average_interval: '3.5'
      };

      mockedDb.query.mockResolvedValue({
        rows: [mockStats],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await spacedRepetitionService.getUserStatistics(mockUserId);

      expect(result).toEqual({
        total_cards: 25,
        due_today: 5,
        mastered: 10,
        learning: 15,
        average_interval: 3.5
      });
    });

    it('should handle missing statistics gracefully', async () => {
      const mockStats = {
        total_cards: '0',
        due_today: '0',
        mastered: '0',
        learning: '0',
        average_interval: null
      };

      mockedDb.query.mockResolvedValue({
        rows: [mockStats],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await spacedRepetitionService.getUserStatistics(mockUserId);

      expect(result.average_interval).toBe(0);
    });
  });

  describe('bulkCreateCards', () => {
    it('should create multiple cards in a transaction', async () => {
      const problemIds = [uuidv4(), uuidv4(), uuidv4()];
      const mockCards = problemIds.map(id => ({
        id: uuidv4(),
        user_id: mockUserId,
        problem_id: id,
        interval: 1,
        repetitions: 0,
        easiness: 2.5
      }));

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ command: 'BEGIN' })
          .mockResolvedValue({ rows: [mockCards[0]], rowCount: 1 })
          .mockResolvedValue({ rows: [mockCards[1]], rowCount: 1 })
          .mockResolvedValue({ rows: [mockCards[2]], rowCount: 1 })
          .mockResolvedValueOnce({ command: 'COMMIT' }),
        release: jest.fn()
      };

      mockedDb.connect.mockResolvedValue(mockClient as any);

      const result = await spacedRepetitionService.bulkCreateCards(mockUserId, problemIds);

      expect(result).toHaveLength(3);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const problemIds = [uuidv4()];

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ command: 'BEGIN' })
          .mockRejectedValueOnce(new Error('Insert failed'))
          .mockResolvedValueOnce({ command: 'ROLLBACK' }),
        release: jest.fn()
      };

      mockedDb.connect.mockResolvedValue(mockClient as any);

      await expect(spacedRepetitionService.bulkCreateCards(mockUserId, problemIds))
        .rejects.toThrow('Insert failed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should skip existing cards with ON CONFLICT', async () => {
      const problemIds = [uuidv4(), uuidv4()];

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ command: 'BEGIN' })
          .mockResolvedValueOnce({ rows: [{ id: uuidv4() }], rowCount: 1 }) // new card
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // existing card (conflict)
          .mockResolvedValueOnce({ command: 'COMMIT' }),
        release: jest.fn()
      };

      mockedDb.connect.mockResolvedValue(mockClient as any);

      const result = await spacedRepetitionService.bulkCreateCards(mockUserId, problemIds);

      expect(result).toHaveLength(1); // Only one new card created
    });
  });

  describe('deleteCard', () => {
    it('should delete card successfully', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 1,
        command: 'DELETE',
        oid: 0,
        fields: []
      });

      const result = await spacedRepetitionService.deleteCard(mockUserId, mockProblemId);

      expect(result).toBe(true);
      expect(mockedDb.query).toHaveBeenCalledWith(
        'DELETE FROM spaced_repetition_cards WHERE user_id = $1 AND problem_id = $2',
        [mockUserId, mockProblemId]
      );
    });

    it('should return false if card not found', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'DELETE',
        oid: 0,
        fields: []
      });

      const result = await spacedRepetitionService.deleteCard(mockUserId, mockProblemId);

      expect(result).toBe(false);
    });
  });

  describe('resetCard', () => {
    it('should reset card to initial values', async () => {
      const mockResetCard = {
        user_id: mockUserId,
        problem_id: mockProblemId,
        interval: 1,
        repetitions: 0,
        easiness: 2.5,
        next_review: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      mockedDb.query.mockResolvedValue({
        rows: [mockResetCard],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      });

      const result = await spacedRepetitionService.resetCard(mockUserId, mockProblemId);

      expect(result).toEqual(mockResetCard);
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SET interval = 1, repetitions = 0, easiness = 2.5'),
        [mockUserId, mockProblemId]
      );
    });
  });

  describe('calculateNextReview (SM-2 Algorithm)', () => {
    it('should handle first correct review (repetitions = 0)', () => {
      const service = new SpacedRepetitionService();

      // Access private method for testing
      const calculateNextReview = (service as any).calculateNextReview.bind(service);

      const result = calculateNextReview(1, 0, 2.5, 4);

      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);
      expect(result.easiness).toBeCloseTo(2.6, 1);
    });

    it('should handle second correct review (repetitions = 1)', () => {
      const service = new SpacedRepetitionService();
      const calculateNextReview = (service as any).calculateNextReview.bind(service);

      const result = calculateNextReview(1, 1, 2.5, 4);

      expect(result.interval).toBe(6);
      expect(result.repetitions).toBe(2);
    });

    it('should calculate exponential intervals for subsequent reviews', () => {
      const service = new SpacedRepetitionService();
      const calculateNextReview = (service as any).calculateNextReview.bind(service);

      const result = calculateNextReview(6, 2, 2.5, 4);

      expect(result.interval).toBe(15); // 6 * 2.5
      expect(result.repetitions).toBe(3);
    });

    it('should reset on incorrect review', () => {
      const service = new SpacedRepetitionService();
      const calculateNextReview = (service as any).calculateNextReview.bind(service);

      const result = calculateNextReview(15, 3, 2.8, 1); // poor quality

      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(0);
      expect(result.easiness).toBeLessThan(2.8);
    });

    it('should maintain minimum easiness factor', () => {
      const service = new SpacedRepetitionService();
      const calculateNextReview = (service as any).calculateNextReview.bind(service);

      const result = calculateNextReview(1, 0, 1.3, 0); // very poor quality

      expect(result.easiness).toBeGreaterThanOrEqual(1.3);
    });

    it('should adjust easiness factor based on quality', () => {
      const service = new SpacedRepetitionService();
      const calculateNextReview = (service as any).calculateNextReview.bind(service);

      // Perfect quality (5) should increase easiness
      const perfectResult = calculateNextReview(1, 0, 2.5, 5);
      expect(perfectResult.easiness).toBeGreaterThan(2.5);

      // Poor quality (3) should maintain easiness roughly
      const okResult = calculateNextReview(1, 0, 2.5, 3);
      expect(Math.abs(okResult.easiness - 2.5)).toBeLessThan(0.2);

      // Very poor quality (0) should decrease easiness
      const poorResult = calculateNextReview(1, 0, 2.5, 0);
      expect(poorResult.easiness).toBeLessThan(2.5);
    });
  });
});