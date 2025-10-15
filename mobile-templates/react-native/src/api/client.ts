import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { getSecureItem, setSecureItem, removeSecureItem } from '../utils/secureStorage';

const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api/v1'
  : 'https://api.sbuddy.com/api/v1';

class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.loadTokens();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // If 401 and we haven't retried yet, try refreshing token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newAccessToken = await this.refreshAccessToken();
            if (newAccessToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, logout user
            await this.logout();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async loadTokens() {
    try {
      this.accessToken = await getSecureItem('accessToken');
      this.refreshToken = await getSecureItem('refreshToken');
    } catch (error) {
      console.error('Failed to load tokens:', error);
    }
  }

  private async saveTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;

    await setSecureItem('accessToken', accessToken);
    await setSecureItem('refreshToken', refreshToken);
  }

  private async clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;

    await removeSecureItem('accessToken');
    await removeSecureItem('refreshToken');
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshToken) {
      return null;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
        refresh_token: this.refreshToken,
      });

      const { accessToken, refreshToken } = response.data;
      await this.saveTokens(accessToken, refreshToken);
      return accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  // ===== Authentication Methods =====

  async login(email: string, password: string, tfaCode?: string) {
    const response = await this.client.post('/auth/login', {
      email,
      password,
      tfa_code: tfaCode,
    });

    const { user, tokens } = response.data;
    await this.saveTokens(tokens.accessToken, tokens.refreshToken);

    return { user, tokens };
  }

  async register(email: string, password: string) {
    const response = await this.client.post('/auth/register', {
      email,
      password,
    });

    return response.data;
  }

  async logout() {
    try {
      if (this.refreshToken) {
        await this.client.post('/auth/logout', {
          refresh_token: this.refreshToken,
        });
      }
    } finally {
      await this.clearTokens();
    }
  }

  async getProfile() {
    const response = await this.client.get('/auth/profile');
    return response.data.user;
  }

  // ===== OCR Methods =====

  async processImage(imageUri: string) {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as any);

    const response = await this.client.post('/ocr/process', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  async processMultipleProblems(imageUri: string) {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as any);

    const response = await this.client.post('/ocr/process-multi', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  // ===== Problems Methods =====

  async searchProblems(params: {
    query?: string;
    subject?: string;
    difficulty?: string;
    limit?: number;
    offset?: number;
  }) {
    const response = await this.client.get('/problems/search', { params });
    return response.data;
  }

  async getProblem(id: string) {
    const response = await this.client.get(`/problems/${id}`);
    return response.data.problem;
  }

  async submitAnswer(problemId: string, answer: string, timeSpent: number) {
    const response = await this.client.post(`/problems/${problemId}/answer`, {
      answer,
      time_spent: timeSpent,
    });
    return response.data;
  }

  // ===== Study Sets Methods =====

  async getStudySets() {
    const response = await this.client.get('/study-sets');
    return response.data.study_sets;
  }

  async createStudySet(name: string, description?: string, tags?: string[]) {
    const response = await this.client.post('/study-sets', {
      name,
      description,
      tags,
      is_public: false,
    });
    return response.data.study_set;
  }

  async getStudySetProblems(setId: string) {
    const response = await this.client.get(`/study-sets/${setId}/problems`);
    return response.data.problems;
  }

  async addProblemToSet(setId: string, problemId: string, notes?: string) {
    const response = await this.client.post(`/study-sets/${setId}/problems`, {
      problem_id: problemId,
      custom_notes: notes,
    });
    return response.data;
  }

  // ===== Spaced Repetition Methods =====

  async getDueCards(limit: number = 20) {
    const response = await this.client.get('/study/due-cards', {
      params: { limit },
    });
    return response.data.due_cards;
  }

  async reviewCard(cardId: string, quality: number) {
    const response = await this.client.post('/study/review', {
      card_id: cardId,
      quality,
    });
    return response.data;
  }

  async getStudyStats() {
    const response = await this.client.get('/study/statistics');
    return response.data.statistics;
  }

  // ===== Gamification Methods =====

  async getUserScore() {
    const response = await this.client.get('/gamification/score');
    return response.data.score;
  }

  async getLeaderboard(limit: number = 10) {
    const response = await this.client.get('/gamification/leaderboard', {
      params: { limit },
    });
    return response.data.leaderboard;
  }

  async getDailyChallenge() {
    const response = await this.client.get('/gamification/daily-challenge');
    return response.data;
  }
}

export default new ApiClient();
