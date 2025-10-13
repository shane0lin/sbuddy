import enhancedAuthService from '../../src/services/enhancedAuthService';
import { db } from '../../src/models/database';
import bcrypt from 'bcryptjs';

jest.mock('../../src/models/database');
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue(true),
  })),
}));

describe('EnhancedAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        subscription_tier: 'free',
        tenant_id: 'tenant-123',
        email_verified: false,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
      };

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // getUserByEmail returns null
        .mockResolvedValueOnce({ rows: [{ id: 'tenant-123' }] }) // createTenant
        .mockResolvedValueOnce({ rows: [mockUser] }) // insert user
        .mockResolvedValueOnce({ rows: [] }); // insert email verification token

      const result = await enhancedAuthService.register('test@example.com', 'password123');

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.message).toContain('verify your account');
    });

    it('should throw error if user already exists', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'user-123', email: 'test@example.com' }],
      });

      await expect(
        enhancedAuthService.register('test@example.com', 'password123')
      ).rejects.toThrow('User already exists');
    });
  });

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: await bcrypt.hash('password123', 12),
        subscription_tier: 'free',
        tenant_id: 'tenant-123',
        email_verified: true,
        role: 'user',
        two_factor_enabled: false,
      };

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockUser] }) // getUserByEmail
        .mockResolvedValueOnce({ rows: [] }); // insert refresh token

      const result = await enhancedAuthService.login('test@example.com', 'password123');

      expect(result.user).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should throw error for invalid credentials', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        enhancedAuthService.login('test@example.com', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error if email not verified', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: await bcrypt.hash('password123', 12),
        email_verified: false,
      };

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });

      await expect(
        enhancedAuthService.login('test@example.com', 'password123')
      ).rejects.toThrow('verify your email');
    });

    it('should require 2FA code when enabled', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: await bcrypt.hash('password123', 12),
        email_verified: true,
        two_factor_enabled: true,
        two_factor_secret: 'secret123',
      };

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });

      await expect(
        enhancedAuthService.login('test@example.com', 'password123')
      ).rejects.toThrow('2FA code required');
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh token successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        tenant_id: 'tenant-123',
        role: 'user',
      };

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ token: 'refresh-token', expires_at: new Date(Date.now() + 86400000) }] }) // verify refresh token
        .mockResolvedValueOnce({ rows: [mockUser] }) // getUserById
        .mockResolvedValueOnce({ rows: [] }) // delete old refresh token
        .mockResolvedValueOnce({ rows: [] }); // insert new refresh token

      const oldRefreshToken = 'old-refresh-token';

      // Mock JWT verification
      jest.spyOn(require('jsonwebtoken'), 'verify').mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        type: 'refresh',
      });

      const result = await enhancedAuthService.refreshAccessToken(oldRefreshToken);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw error for invalid refresh token', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      jest.spyOn(require('jsonwebtoken'), 'verify').mockReturnValue({
        userId: 'user-123',
        type: 'refresh',
      });

      await expect(
        enhancedAuthService.refreshAccessToken('invalid-token')
      ).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const mockToken = {
        id: 'token-123',
        user_id: 'user-123',
        token: 'verification-token',
        expires_at: new Date(Date.now() + 86400000),
      };

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockToken] }) // find verification token
        .mockResolvedValueOnce({ rows: [] }) // update user
        .mockResolvedValueOnce({ rows: [] }); // delete token

      const result = await enhancedAuthService.verifyEmail('verification-token');

      expect(result.message).toContain('verified successfully');
    });

    it('should throw error for expired token', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        enhancedAuthService.verifyEmail('expired-token')
      ).rejects.toThrow('Invalid or expired');
    });
  });

  describe('requestPasswordReset', () => {
    it('should send password reset email', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockUser] }) // getUserByEmail
        .mockResolvedValueOnce({ rows: [] }); // insert reset token

      const result = await enhancedAuthService.requestPasswordReset('test@example.com');

      expect(result.message).toContain('reset link has been sent');
    });

    it('should not reveal if user does not exist', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await enhancedAuthService.requestPasswordReset('nonexistent@example.com');

      expect(result.message).toContain('reset link has been sent');
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const mockToken = {
        id: 'token-123',
        user_id: 'user-123',
        token: 'reset-token',
        expires_at: new Date(Date.now() + 3600000),
        used: false,
      };

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockToken] }) // find reset token
        .mockResolvedValueOnce({ rows: [] }) // update password
        .mockResolvedValueOnce({ rows: [] }) // mark token as used
        .mockResolvedValueOnce({ rows: [] }); // revoke all tokens

      const result = await enhancedAuthService.resetPassword('reset-token', 'newpassword123');

      expect(result.message).toContain('reset successful');
    });

    it('should throw error for invalid or used token', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        enhancedAuthService.resetPassword('invalid-token', 'newpassword')
      ).rejects.toThrow('Invalid or expired');
    });
  });

  describe('findOrCreateOAuthUser', () => {
    it('should create new user for OAuth', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        tenant_id: 'tenant-123',
        email_verified: true,
        oauth_provider: 'google',
        oauth_id: 'google-123',
        role: 'user',
      };

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // getUserByOAuth
        .mockResolvedValueOnce({ rows: [] }) // getUserByEmail
        .mockResolvedValueOnce({ rows: [{ id: 'tenant-123' }] }) // createTenant
        .mockResolvedValueOnce({ rows: [mockUser] }) // insert user
        .mockResolvedValueOnce({ rows: [] }); // insert refresh token

      const result = await enhancedAuthService.findOrCreateOAuthUser(
        'test@example.com',
        'google',
        'google-123'
      );

      expect(result.user.email).toBe('test@example.com');
      expect(result.isNewUser).toBe(true);
      expect(result.tokens.accessToken).toBeDefined();
    });

    it('should link OAuth to existing user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        tenant_id: 'tenant-123',
        role: 'user',
      };

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // getUserByOAuth
        .mockResolvedValueOnce({ rows: [mockUser] }) // getUserByEmail
        .mockResolvedValueOnce({ rows: [] }) // update user with OAuth
        .mockResolvedValueOnce({ rows: [] }); // insert refresh token

      const result = await enhancedAuthService.findOrCreateOAuthUser(
        'test@example.com',
        'google',
        'google-123'
      );

      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens).toBeDefined();
    });
  });

  describe('exportUserData', () => {
    it('should export all user data', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        subscription_tier: 'free',
        email_verified: true,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
      };

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockUser] }) // getUserById
        .mockResolvedValueOnce({ rows: [] }) // progress
        .mockResolvedValueOnce({ rows: [] }) // sessions
        .mockResolvedValueOnce({ rows: [] }) // cards
        .mockResolvedValueOnce({ rows: [] }); // scores

      const result = await enhancedAuthService.exportUserData('user-123');

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.progress).toBeDefined();
      expect(result.study_sessions).toBeDefined();
    });
  });

  describe('deleteUserAccount', () => {
    it('should delete user account successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: await bcrypt.hash('password123', 12),
      };

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockUser] }) // getUserByEmail
        .mockResolvedValueOnce({ rows: [] }); // delete user

      const result = await enhancedAuthService.deleteUserAccount('user-123', 'password123');

      expect(result.message).toContain('deleted successfully');
    });

    it('should throw error for wrong password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: await bcrypt.hash('password123', 12),
      };

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });

      await expect(
        enhancedAuthService.deleteUserAccount('user-123', 'wrongpassword')
      ).rejects.toThrow('Invalid password');
    });
  });
});
