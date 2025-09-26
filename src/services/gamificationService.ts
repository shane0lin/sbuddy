import { db } from '../models/database';
import { v4 as uuidv4 } from 'uuid';

export interface UserScore {
  id: string;
  user_id: string;
  total_points: number;
  level: number;
  streak_days: number;
  longest_streak: number;
  problems_solved: number;
  achievements: string[];
  last_activity: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition_type: 'problems_solved' | 'streak_days' | 'perfect_score' | 'difficulty_mastery' | 'subject_mastery';
  condition_value: number;
  points_reward: number;
  badge_level: 'bronze' | 'silver' | 'gold' | 'diamond';
}

export class GamificationService {
  private readonly pointsPerCorrectAnswer = 10;
  private readonly streakBonusMultiplier = 1.5;
  private readonly difficultyMultipliers = {
    easy: 1,
    medium: 1.5,
    hard: 2
  };

  async initializeUserScore(userId: string): Promise<UserScore> {
    const query = `
      INSERT INTO user_scores (id, user_id, total_points, level, streak_days, longest_streak, problems_solved, achievements, last_activity)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO NOTHING
      RETURNING *
    `;

    const values = [uuidv4(), userId, 0, 1, 0, 0, 0, []];

    let result = await db.query(query, values);

    if (result.rows.length === 0) {
      // User already exists, return existing score
      const existingQuery = 'SELECT * FROM user_scores WHERE user_id = $1';
      result = await db.query(existingQuery, [userId]);
    }

    return result.rows[0];
  }

  async updateScoreAfterProblem(
    userId: string,
    isCorrect: boolean,
    problemDifficulty: 'easy' | 'medium' | 'hard',
    timeSpent: number // in seconds
  ): Promise<{
    pointsEarned: number;
    levelUp: boolean;
    newLevel: number;
    achievements: Achievement[];
  }> {
    const userScore = await this.getUserScore(userId);
    if (!userScore) {
      throw new Error('User score not found');
    }

    let pointsEarned = 0;
    let levelUp = false;
    let newAchievements: Achievement[] = [];

    if (isCorrect) {
      // Base points
      pointsEarned = this.pointsPerCorrectAnswer;

      // Difficulty multiplier
      pointsEarned *= this.difficultyMultipliers[problemDifficulty];

      // Time bonus (faster solutions get more points)
      const timeBonus = this.calculateTimeBonus(timeSpent);
      pointsEarned += timeBonus;

      // Streak bonus
      if (this.isConsecutiveDay(userScore.last_activity)) {
        pointsEarned *= this.streakBonusMultiplier;
      }

      // Update database
      const newTotalPoints = userScore.total_points + Math.round(pointsEarned);
      const newProblemsCount = userScore.problems_solved + 1;
      const newLevel = this.calculateLevel(newTotalPoints);
      const newStreakDays = this.calculateStreakDays(userScore);

      levelUp = newLevel > userScore.level;

      const updateQuery = `
        UPDATE user_scores SET
          total_points = $1,
          level = $2,
          streak_days = $3,
          longest_streak = $4,
          problems_solved = $5,
          last_activity = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $6
        RETURNING *
      `;

      const longestStreak = Math.max(userScore.longest_streak, newStreakDays);

      await db.query(updateQuery, [
        newTotalPoints,
        newLevel,
        newStreakDays,
        longestStreak,
        newProblemsCount,
        userId
      ]);

      // Check for new achievements
      newAchievements = await this.checkAndAwardAchievements(userId, {
        totalPoints: newTotalPoints,
        level: newLevel,
        streakDays: newStreakDays,
        problemsSolved: newProblemsCount,
        currentAchievements: userScore.achievements
      });

      return {
        pointsEarned: Math.round(pointsEarned),
        levelUp,
        newLevel,
        achievements: newAchievements
      };
    }

    // Incorrect answer - no points but still update last activity
    await db.query(
      'UPDATE user_scores SET last_activity = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId]
    );

    return {
      pointsEarned: 0,
      levelUp: false,
      newLevel: userScore.level,
      achievements: []
    };
  }

  private calculateTimeBonus(timeSpent: number): number {
    // Bonus points for solving quickly (diminishing returns)
    const maxBonus = 5;
    const optimalTime = 60; // 1 minute

    if (timeSpent <= optimalTime) {
      return maxBonus;
    }

    const bonus = maxBonus * Math.exp(-(timeSpent - optimalTime) / 120);
    return Math.max(0, bonus);
  }

  private calculateLevel(totalPoints: number): number {
    // Level formula: level = floor(sqrt(points / 100)) + 1
    // This means levels require: 0, 100, 400, 900, 1600, 2500, ... points
    return Math.floor(Math.sqrt(totalPoints / 100)) + 1;
  }

  private isConsecutiveDay(lastActivity: Date): boolean {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastActivityDate = new Date(lastActivity);
    lastActivityDate.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);

    return lastActivityDate.getTime() >= yesterday.getTime();
  }

  private calculateStreakDays(userScore: UserScore): number {
    if (this.isConsecutiveDay(userScore.last_activity)) {
      return userScore.streak_days + 1;
    }
    return 1; // Reset streak
  }

  async getUserScore(userId: string): Promise<UserScore | null> {
    const query = 'SELECT * FROM user_scores WHERE user_id = $1';
    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  async getLeaderboard(tenantId: string, limit: number = 10): Promise<Array<{
    user_id: string;
    email: string;
    total_points: number;
    level: number;
    problems_solved: number;
    rank: number;
  }>> {
    const query = `
      WITH ranked_scores AS (
        SELECT
          us.*,
          u.email,
          ROW_NUMBER() OVER (ORDER BY us.total_points DESC) as rank
        FROM user_scores us
        JOIN users u ON us.user_id = u.id
        WHERE u.tenant_id = $1
      )
      SELECT user_id, email, total_points, level, problems_solved, rank
      FROM ranked_scores
      ORDER BY rank
      LIMIT $2
    `;

    const result = await db.query(query, [tenantId, limit]);
    return result.rows;
  }

  async getUserRank(userId: string): Promise<number> {
    const user = await db.query('SELECT tenant_id FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) return 0;

    const tenantId = user.rows[0].tenant_id;

    const query = `
      WITH ranked_scores AS (
        SELECT
          us.user_id,
          ROW_NUMBER() OVER (ORDER BY us.total_points DESC) as rank
        FROM user_scores us
        JOIN users u ON us.user_id = u.id
        WHERE u.tenant_id = $1
      )
      SELECT rank FROM ranked_scores WHERE user_id = $2
    `;

    const result = await db.query(query, [tenantId, userId]);
    return result.rows[0]?.rank || 0;
  }

  private async checkAndAwardAchievements(
    userId: string,
    stats: {
      totalPoints: number;
      level: number;
      streakDays: number;
      problemsSolved: number;
      currentAchievements: string[];
    }
  ): Promise<Achievement[]> {
    const achievements = await this.getAvailableAchievements();
    const newAchievements: Achievement[] = [];

    for (const achievement of achievements) {
      // Skip if user already has this achievement
      if (stats.currentAchievements.includes(achievement.id)) {
        continue;
      }

      let qualified = false;

      switch (achievement.condition_type) {
        case 'problems_solved':
          qualified = stats.problemsSolved >= achievement.condition_value;
          break;
        case 'streak_days':
          qualified = stats.streakDays >= achievement.condition_value;
          break;
        case 'perfect_score':
          // This would require additional tracking of perfect scores
          break;
        default:
          break;
      }

      if (qualified) {
        newAchievements.push(achievement);
        await this.awardAchievement(userId, achievement.id);
      }
    }

    return newAchievements;
  }

  private async awardAchievement(userId: string, achievementId: string): Promise<void> {
    const query = `
      UPDATE user_scores
      SET achievements = array_append(achievements, $1),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2
    `;

    await db.query(query, [achievementId, userId]);
  }

  private async getAvailableAchievements(): Promise<Achievement[]> {
    // In a real implementation, these would come from the database
    return [
      {
        id: 'first_problem',
        name: 'First Steps',
        description: 'Solve your first problem',
        icon: '🎯',
        condition_type: 'problems_solved',
        condition_value: 1,
        points_reward: 50,
        badge_level: 'bronze'
      },
      {
        id: 'problem_solver_10',
        name: 'Problem Solver',
        description: 'Solve 10 problems',
        icon: '🧮',
        condition_type: 'problems_solved',
        condition_value: 10,
        points_reward: 100,
        badge_level: 'bronze'
      },
      {
        id: 'dedicated_learner_7',
        name: 'Dedicated Learner',
        description: '7-day streak',
        icon: '🔥',
        condition_type: 'streak_days',
        condition_value: 7,
        points_reward: 200,
        badge_level: 'silver'
      },
      {
        id: 'streak_master_30',
        name: 'Streak Master',
        description: '30-day streak',
        icon: '⚡',
        condition_type: 'streak_days',
        condition_value: 30,
        points_reward: 500,
        badge_level: 'gold'
      }
    ];
  }

  async getDailyChallenge(userId: string): Promise<{
    challenge: {
      id: string;
      title: string;
      description: string;
      points_reward: number;
      problems_required: number;
    };
    progress: number;
    completed: boolean;
  }> {
    // Simple daily challenge: solve X problems
    const today = new Date().toISOString().split('T')[0];

    const todayProblemsQuery = `
      SELECT COUNT(*) as count
      FROM user_progress up
      WHERE up.user_id = $1
        AND DATE(up.last_reviewed_at) = $2
        AND up.attempts > up.correct_attempts
    `;

    const result = await db.query(todayProblemsQuery, [userId, today]);
    const todayProgress = parseInt(result.rows[0]?.count || '0');

    const challenge = {
      id: `daily_${today}`,
      title: 'Daily Challenge',
      description: 'Solve 5 problems today',
      points_reward: 100,
      problems_required: 5
    };

    return {
      challenge,
      progress: todayProgress,
      completed: todayProgress >= challenge.problems_required
    };
  }

  async createCustomChallenge(
    userId: string,
    title: string,
    description: string,
    problemIds: string[],
    pointsReward: number
  ): Promise<string> {
    const challengeId = uuidv4();

    const query = `
      INSERT INTO challenges (id, user_id, title, description, problem_ids, points_reward, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    const result = await db.query(query, [
      challengeId,
      userId,
      title,
      description,
      problemIds,
      pointsReward
    ]);

    return result.rows[0].id;
  }
}

// Database table creation for gamification
export const createGamificationTables = async () => {
  const queries = [
    `CREATE TABLE IF NOT EXISTS user_scores (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      total_points INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      streak_days INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      problems_solved INTEGER DEFAULT 0,
      achievements TEXT[] DEFAULT '{}',
      last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS challenges (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      problem_ids UUID[],
      points_reward INTEGER DEFAULT 0,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE INDEX IF NOT EXISTS idx_user_scores_user_id ON user_scores(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_user_scores_points ON user_scores(total_points DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_challenges_user_id ON challenges(user_id);`
  ];

  for (const query of queries) {
    await db.query(query);
  }
};

export default new GamificationService();