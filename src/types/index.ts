export interface User {
  id: string;
  email: string;
  password_hash?: string;
  subscription_tier: 'free' | 'premium' | 'enterprise';
  tenant_id: string;
  email_verified: boolean;
  oauth_provider?: 'google' | 'apple';
  oauth_id?: string;
  role: 'user' | 'admin' | 'moderator';
  two_factor_secret?: string;
  two_factor_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
}

export interface EmailVerificationToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
}

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
}

export interface Problem {
  id: string;
  title: string;
  content: string;
  source: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  subject: string;
  exam_type: string;
  exam_year: number;
  problem_number: number;
  tags: string[];
  solution?: string;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserProgress {
  id: string;
  user_id: string;
  problem_id: string;
  attempts: number;
  correct_attempts: number;
  last_reviewed_at: Date;
  next_review_at: Date;
  difficulty_rating: number;
  mastery_level: 'learning' | 'reviewing' | 'mastered';
  created_at: Date;
  updated_at: Date;
}

export interface StudySession {
  id: string;
  user_id: string;
  problems: string[];
  session_type: 'review' | 'practice' | 'exam';
  score: number;
  completed_at?: Date;
  created_at: Date;
}

export interface StudySet {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  is_public: boolean;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

export interface StudySetProblem {
  id: string;
  study_set_id: string;
  problem_id: string;
  added_at: Date;
  custom_notes?: string;
}

export interface OCRResult {
  success: boolean;
  text: string;
  confidence: number;
  problems_detected: number;
  problems: {
    text: string;
    bbox: number[];
    confidence: number;
  }[];
}

export interface ProblemMatch {
  problem_id: string;
  similarity_score: number;
  match_type: 'exact' | 'similar' | 'partial';
  problem: Problem;
}

export interface SpacedRepetitionCard {
  user_id: string;
  problem_id: string;
  interval: number;
  repetitions: number;
  easiness: number;
  next_review: Date;
}