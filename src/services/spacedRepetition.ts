import { db } from '../models/database';
import { SpacedRepetitionCard, UserProgress } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class SpacedRepetitionService {
  async createCard(userId: string, problemId: string): Promise<SpacedRepetitionCard> {
    const query = `
      INSERT INTO spaced_repetition_cards (id, user_id, problem_id, interval, repetitions, easiness, next_review)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, problem_id) DO UPDATE SET
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      uuidv4(),
      userId,
      problemId,
      1, // Initial interval (1 day)
      0, // Initial repetitions
      2.5, // Initial easiness factor
      new Date(Date.now() + 24 * 60 * 60 * 1000) // Next review in 1 day
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  async updateCardAfterReview(
    userId: string,
    problemId: string,
    quality: number // 0-5 rating (0 = complete failure, 5 = perfect)
  ): Promise<SpacedRepetitionCard> {
    // Get current card data
    const currentCard = await this.getCard(userId, problemId);
    if (!currentCard) {
      throw new Error('Card not found');
    }

    // SM-2 Algorithm implementation
    const { interval, repetitions, easiness } = this.calculateNextReview(
      currentCard.interval,
      currentCard.repetitions,
      currentCard.easiness,
      quality
    );

    const nextReview = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);

    const query = `
      UPDATE spaced_repetition_cards
      SET interval = $1, repetitions = $2, easiness = $3, next_review = $4, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $5 AND problem_id = $6
      RETURNING *
    `;

    const result = await db.query(query, [interval, repetitions, easiness, nextReview, userId, problemId]);
    return result.rows[0];
  }

  private calculateNextReview(
    currentInterval: number,
    currentRepetitions: number,
    currentEasiness: number,
    quality: number
  ): { interval: number; repetitions: number; easiness: number } {
    let newEasiness = currentEasiness;
    let newRepetitions = currentRepetitions;
    let newInterval = currentInterval;

    if (quality >= 3) {
      // Correct response
      if (currentRepetitions === 0) {
        newInterval = 1;
      } else if (currentRepetitions === 1) {
        newInterval = 6;
      } else {
        newInterval = Math.round(currentInterval * currentEasiness);
      }
      newRepetitions = currentRepetitions + 1;
    } else {
      // Incorrect response - restart
      newRepetitions = 0;
      newInterval = 1;
    }

    // Update easiness factor
    newEasiness = currentEasiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    newEasiness = Math.max(1.3, newEasiness); // Minimum easiness

    return {
      interval: Math.max(1, newInterval),
      repetitions: newRepetitions,
      easiness: newEasiness
    };
  }

  async getCard(userId: string, problemId: string): Promise<SpacedRepetitionCard | null> {
    const query = 'SELECT * FROM spaced_repetition_cards WHERE user_id = $1 AND problem_id = $2';
    const result = await db.query(query, [userId, problemId]);
    return result.rows[0] || null;
  }

  async getDueCards(userId: string, limit: number = 20): Promise<SpacedRepetitionCard[]> {
    const query = `
      SELECT src.*, p.title, p.content, p.subject, p.category, p.difficulty
      FROM spaced_repetition_cards src
      JOIN problems p ON src.problem_id = p.id
      WHERE src.user_id = $1 AND src.next_review <= CURRENT_TIMESTAMP
      ORDER BY src.next_review ASC
      LIMIT $2
    `;

    const result = await db.query(query, [userId, limit]);
    return result.rows;
  }

  async getUpcomingReviews(userId: string, days: number = 7): Promise<Array<{
    date: string;
    count: number;
    cards: SpacedRepetitionCard[];
  }>> {
    const query = `
      SELECT DATE(next_review) as review_date, COUNT(*) as count,
             array_agg(src.*) as cards
      FROM spaced_repetition_cards src
      JOIN problems p ON src.problem_id = p.id
      WHERE src.user_id = $1
        AND src.next_review BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '${days} days'
      GROUP BY DATE(next_review)
      ORDER BY review_date
    `;

    const result = await db.query(query, [userId]);
    return result.rows.map(row => ({
      date: row.review_date.toISOString().split('T')[0],
      count: parseInt(row.count),
      cards: row.cards
    }));
  }

  async getUserStatistics(userId: string): Promise<{
    total_cards: number;
    due_today: number;
    mastered: number;
    learning: number;
    average_interval: number;
  }> {
    const query = `
      SELECT
        COUNT(*) as total_cards,
        COUNT(CASE WHEN next_review <= CURRENT_TIMESTAMP THEN 1 END) as due_today,
        COUNT(CASE WHEN repetitions >= 4 THEN 1 END) as mastered,
        COUNT(CASE WHEN repetitions < 4 THEN 1 END) as learning,
        AVG(interval) as average_interval
      FROM spaced_repetition_cards
      WHERE user_id = $1
    `;

    const result = await db.query(query, [userId]);
    const stats = result.rows[0];

    return {
      total_cards: parseInt(stats.total_cards),
      due_today: parseInt(stats.due_today),
      mastered: parseInt(stats.mastered),
      learning: parseInt(stats.learning),
      average_interval: parseFloat(stats.average_interval) || 0
    };
  }

  async bulkCreateCards(userId: string, problemIds: string[]): Promise<SpacedRepetitionCard[]> {
    const client = await db.connect();
    const cards: SpacedRepetitionCard[] = [];

    try {
      await client.query('BEGIN');

      for (const problemId of problemIds) {
        const query = `
          INSERT INTO spaced_repetition_cards (id, user_id, problem_id, interval, repetitions, easiness, next_review)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (user_id, problem_id) DO NOTHING
          RETURNING *
        `;

        const values = [
          uuidv4(),
          userId,
          problemId,
          1,
          0,
          2.5,
          new Date(Date.now() + 24 * 60 * 60 * 1000)
        ];

        const result = await client.query(query, values);
        if (result.rows[0]) {
          cards.push(result.rows[0]);
        }
      }

      await client.query('COMMIT');
      return cards;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteCard(userId: string, problemId: string): Promise<boolean> {
    const query = 'DELETE FROM spaced_repetition_cards WHERE user_id = $1 AND problem_id = $2';
    const result = await db.query(query, [userId, problemId]);
    return (result.rowCount || 0) > 0;
  }

  async resetCard(userId: string, problemId: string): Promise<SpacedRepetitionCard> {
    const query = `
      UPDATE spaced_repetition_cards
      SET interval = 1, repetitions = 0, easiness = 2.5,
          next_review = CURRENT_TIMESTAMP + INTERVAL '1 day',
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND problem_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [userId, problemId]);
    return result.rows[0];
  }
}

export default new SpacedRepetitionService();