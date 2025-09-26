import { GamificationService } from '../../src/services/gamificationService';
import { UserStats, Achievement, LevelInfo } from '../../src/types';
import { v4 as uuidv4 } from 'uuid';

// Mock the database module
jest.mock('../../src/models/database', () => ({
  db: {
    query: jest.fn()
  }
}));

import { db } from '../../src/models/database';

const mockedDb = db as jest.Mocked<typeof db>;

describe('GamificationService', () => {
  let gamificationService: GamificationService;
  const mockUserId = uuidv4();
  const mockTenantId = uuidv4();

  beforeEach(() => {
    gamificationService = new GamificationService();
    jest.clearAllMocks();
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      const mockStats = {
        user_id: mockUserId,
        total_points: 150,
        current_level: 2,
        problems_solved: 25,
        streak_days: 7,
        achievements_unlocked: 3,
        last_activity: new Date()
      };

      mockedDb.query.mockResolvedValue({
        rows: [mockStats],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await gamificationService.getUserStats(mockUserId, mockTenantId);

      expect(result).toEqual(mockStats);
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM user_stats'),
        [mockUserId, mockTenantId]
      );
    });

    it('should create initial stats if user not found', async () => {
      // Mock empty result for existing stats
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock successful creation
      const newStats = {
        user_id: mockUserId,
        tenant_id: mockTenantId,
        total_points: 0,
        current_level: 1,
        problems_solved: 0,
        streak_days: 0,
        achievements_unlocked: 0,
        last_activity: new Date()
      };

      mockedDb.query.mockResolvedValueOnce({
        rows: [newStats],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      });

      const result = await gamificationService.getUserStats(mockUserId, mockTenantId);

      expect(result).toEqual(newStats);
      expect(mockedDb.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('awardPoints', () => {
    it('should award points and update user stats', async () => {
      const existingStats = {
        user_id: mockUserId,
        tenant_id: mockTenantId,
        total_points: 100,
        current_level: 1,
        problems_solved: 10,
        streak_days: 3
      };

      const updatedStats = {
        ...existingStats,
        total_points: 150,
        current_level: 2,
        problems_solved: 11
      };

      // Mock getting existing stats
      mockedDb.query.mockResolvedValueOnce({
        rows: [existingStats],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock updating stats
      mockedDb.query.mockResolvedValueOnce({
        rows: [updatedStats],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      });

      const result = await gamificationService.awardPoints(mockUserId, mockTenantId, 50);

      expect(result.total_points).toBe(150);
      expect(result.problems_solved).toBe(11);
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_stats'),
        expect.arrayContaining([150, 2, 11])
      );
    });

    it('should handle level up when points threshold is reached', async () => {
      const existingStats = {
        user_id: mockUserId,
        tenant_id: mockTenantId,
        total_points: 90,
        current_level: 1,
        problems_solved: 10,
        streak_days: 3
      };

      // Mock getting existing stats
      mockedDb.query.mockResolvedValueOnce({
        rows: [existingStats],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock updating stats with level up
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ ...existingStats, total_points: 140, current_level: 2 }],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      });

      const result = await gamificationService.awardPoints(mockUserId, mockTenantId, 50);

      expect(result.current_level).toBe(2);
      expect(result.total_points).toBe(140);
    });
  });

  describe('updateStreak', () => {
    it('should increment streak for consecutive days', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const existingStats = {
        user_id: mockUserId,
        tenant_id: mockTenantId,
        total_points: 100,
        current_level: 1,
        streak_days: 5,
        last_activity: yesterday
      };

      // Mock getting existing stats
      mockedDb.query.mockResolvedValueOnce({
        rows: [existingStats],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock updating streak
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ ...existingStats, streak_days: 6 }],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      });

      const result = await gamificationService.updateStreak(mockUserId, mockTenantId);

      expect(result.streak_days).toBe(6);
    });

    it('should reset streak if more than one day gap', async () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const existingStats = {
        user_id: mockUserId,
        tenant_id: mockTenantId,
        total_points: 100,
        current_level: 1,
        streak_days: 10,
        last_activity: threeDaysAgo
      };

      // Mock getting existing stats
      mockedDb.query.mockResolvedValueOnce({
        rows: [existingStats],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock resetting streak
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ ...existingStats, streak_days: 1 }],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      });

      const result = await gamificationService.updateStreak(mockUserId, mockTenantId);

      expect(result.streak_days).toBe(1);
    });

    it('should maintain streak if activity was today', async () => {
      const today = new Date();

      const existingStats = {
        user_id: mockUserId,
        tenant_id: mockTenantId,
        total_points: 100,
        current_level: 1,
        streak_days: 5,
        last_activity: today
      };

      // Mock getting existing stats
      mockedDb.query.mockResolvedValueOnce({
        rows: [existingStats],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await gamificationService.updateStreak(mockUserId, mockTenantId);

      expect(result.streak_days).toBe(5);
      // Should not call update since no change needed
      expect(mockedDb.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserAchievements', () => {
    it('should return user achievements', async () => {
      const mockAchievements = [
        {
          id: uuidv4(),
          user_id: mockUserId,
          achievement_id: 'first_problem',
          achievement_name: 'First Steps',
          description: 'Solve your first problem',
          icon: '🎯',
          earned_at: new Date(),
          points_awarded: 10
        },
        {
          id: uuidv4(),
          user_id: mockUserId,
          achievement_id: 'streak_7',
          achievement_name: 'Week Warrior',
          description: 'Maintain a 7-day streak',
          icon: '🔥',
          earned_at: new Date(),
          points_awarded: 50
        }
      ];

      mockedDb.query.mockResolvedValue({
        rows: mockAchievements,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await gamificationService.getUserAchievements(mockUserId, mockTenantId);

      expect(result).toEqual(mockAchievements);
      expect(result).toHaveLength(2);
    });

    it('should return empty array for user with no achievements', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await gamificationService.getUserAchievements(mockUserId, mockTenantId);

      expect(result).toEqual([]);
    });
  });

  describe('checkAndAwardAchievements', () => {
    const mockStats: UserStats = {
      user_id: mockUserId,
      tenant_id: mockTenantId,
      total_points: 100,
      current_level: 2,
      problems_solved: 10,
      streak_days: 7,
      achievements_unlocked: 1,
      last_activity: new Date()
    };

    it('should award first problem achievement', async () => {
      const firstProblemStats = { ...mockStats, problems_solved: 1, achievements_unlocked: 0 };

      // Mock checking existing achievements
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock awarding achievement
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ id: uuidv4() }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      });

      const result = await gamificationService.checkAndAwardAchievements(firstProblemStats);

      expect(result).toHaveLength(1);
      expect(result[0].achievement_id).toBe('first_problem');
    });

    it('should award streak achievements', async () => {
      const streakStats = { ...mockStats, streak_days: 7 };

      // Mock checking existing achievements (no streak achievements)
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock awarding streak achievement
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ id: uuidv4() }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      });

      const result = await gamificationService.checkAndAwardAchievements(streakStats);

      expect(result).toHaveLength(1);
      expect(result[0].achievement_id).toBe('streak_7');
    });

    it('should award problem milestone achievements', async () => {
      const milestoneStats = { ...mockStats, problems_solved: 50 };

      // Mock checking existing achievements
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock awarding milestone achievement
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ id: uuidv4() }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      });

      const result = await gamificationService.checkAndAwardAchievements(milestoneStats);

      expect(result).toHaveLength(1);
      expect(result[0].achievement_id).toBe('problems_50');
    });

    it('should not award achievements already earned', async () => {
      // Mock existing achievements
      mockedDb.query.mockResolvedValue({
        rows: [{ achievement_id: 'first_problem' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await gamificationService.checkAndAwardAchievements(mockStats);

      expect(result).toHaveLength(0);
    });
  });

  describe('getLeaderboard', () => {
    it('should return top users by points', async () => {
      const mockLeaderboard = [
        {
          user_id: uuidv4(),
          username: 'user1@example.com',
          total_points: 500,
          current_level: 5,
          problems_solved: 100,
          rank: 1
        },
        {
          user_id: uuidv4(),
          username: 'user2@example.com',
          total_points: 400,
          current_level: 4,
          problems_solved: 80,
          rank: 2
        }
      ];

      mockedDb.query.mockResolvedValue({
        rows: mockLeaderboard,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await gamificationService.getLeaderboard(mockTenantId, 10);

      expect(result).toEqual(mockLeaderboard);
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY total_points DESC'),
        [mockTenantId, 10]
      );
    });

    it('should handle empty leaderboard', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await gamificationService.getLeaderboard(mockTenantId, 10);

      expect(result).toEqual([]);
    });
  });

  describe('getLevelInfo', () => {
    it('should return level information for current level', () => {
      const levelInfo = gamificationService.getLevelInfo(3);

      expect(levelInfo.level).toBe(3);
      expect(levelInfo.pointsRequired).toBe(400); // 100 * 2^2
      expect(levelInfo.pointsForNext).toBe(800);   // 100 * 2^3
      expect(levelInfo.name).toBe('Explorer');
    });

    it('should return correct level names', () => {
      expect(gamificationService.getLevelInfo(1).name).toBe('Beginner');
      expect(gamificationService.getLevelInfo(2).name).toBe('Apprentice');
      expect(gamificationService.getLevelInfo(10).name).toBe('Master');
      expect(gamificationService.getLevelInfo(15).name).toBe('Grandmaster');
    });

    it('should handle high levels', () => {
      const levelInfo = gamificationService.getLevelInfo(20);
      expect(levelInfo.level).toBe(20);
      expect(levelInfo.name).toBe('Legend');
    });
  });

  describe('calculateLevel', () => {
    it('should calculate correct level from points', () => {
      expect((gamificationService as any).calculateLevel(0)).toBe(1);
      expect((gamificationService as any).calculateLevel(100)).toBe(2);
      expect((gamificationService as any).calculateLevel(300)).toBe(3);
      expect((gamificationService as any).calculateLevel(700)).toBe(4);
      expect((gamificationService as any).calculateLevel(1500)).toBe(5);
    });
  });

  describe('calculatePointsForLevel', () => {
    it('should calculate correct points required for level', () => {
      expect((gamificationService as any).calculatePointsForLevel(1)).toBe(0);
      expect((gamificationService as any).calculatePointsForLevel(2)).toBe(100);
      expect((gamificationService as any).calculatePointsForLevel(3)).toBe(300);
      expect((gamificationService as any).calculatePointsForLevel(4)).toBe(700);
    });
  });

  describe('getAvailableAchievements', () => {
    it('should return all available achievements', () => {
      const achievements = (gamificationService as any).getAvailableAchievements();

      expect(achievements).toContainEqual(
        expect.objectContaining({
          id: 'first_problem',
          name: 'First Steps',
          description: 'Solve your first problem'
        })
      );

      expect(achievements).toContainEqual(
        expect.objectContaining({
          id: 'streak_7',
          name: 'Week Warrior',
          description: 'Maintain a 7-day streak'
        })
      );
    });
  });

  describe('calculatePointsAwarded', () => {
    it('should calculate points based on difficulty and performance', () => {
      // Test base points for difficulties
      expect((gamificationService as any).calculatePointsAwarded('easy', 1.0)).toBe(10);
      expect((gamificationService as any).calculatePointsAwarded('medium', 1.0)).toBe(20);
      expect((gamificationService as any).calculatePointsAwarded('hard', 1.0)).toBe(40);

      // Test performance multiplier
      expect((gamificationService as any).calculatePointsAwarded('medium', 0.5)).toBe(10); // 20 * 0.5
      expect((gamificationService as any).calculatePointsAwarded('medium', 2.0)).toBe(40); // 20 * 2.0
    });

    it('should handle invalid difficulty', () => {
      expect((gamificationService as any).calculatePointsAwarded('invalid', 1.0)).toBe(10);
    });
  });
});