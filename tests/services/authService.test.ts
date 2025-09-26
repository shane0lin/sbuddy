import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthService } from '../../src/services/authService';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../../src/models/database', () => ({
  db: {
    query: jest.fn()
  }
}));

import { db } from '../../src/models/database';

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;
const mockedDb = db as jest.Mocked<typeof db>;

describe('AuthService', () => {
  let authService: AuthService;
  const mockUserId = uuidv4();
  const mockTenantId = uuidv4();
  const mockEmail = 'test@example.com';
  const mockPassword = 'password123';
  const mockHashedPassword = '$2a$12$hashedpassword';

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();

    // Set test environment variables
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1h';
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: mockUserId,
        email: mockEmail,
        subscription_tier: 'free',
        tenant_id: mockTenantId,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Mock user doesn't exist
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock tenant creation
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ id: mockTenantId }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      });

      // Mock user creation
      mockedDb.query.mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      });

      mockedBcrypt.hash.mockResolvedValue(mockHashedPassword as never);
      mockedJwt.sign.mockReturnValue('mock-token' as never);

      const result = await authService.register(mockEmail, mockPassword);

      expect(result.user).toEqual(mockUser);
      expect(result.token).toBe('mock-token');
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(mockPassword, 12);
      expect(mockedJwt.sign).toHaveBeenCalledWith(
        {
          userId: mockUser.id,
          email: mockUser.email,
          tenantId: mockUser.tenant_id
        },
        'test-secret',
        { expiresIn: '1h' }
      );
    });

    it('should throw error if user already exists', async () => {
      // Mock user exists
      mockedDb.query.mockResolvedValue({
        rows: [{ id: mockUserId, email: mockEmail }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      await expect(authService.register(mockEmail, mockPassword))
        .rejects.toThrow('User already exists');
    });

    it('should register with existing tenant ID', async () => {
      const existingTenantId = uuidv4();

      // Mock user doesn't exist
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock user creation with existing tenant
      mockedDb.query.mockResolvedValueOnce({
        rows: [{
          id: mockUserId,
          email: mockEmail,
          tenant_id: existingTenantId
        }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      });

      mockedBcrypt.hash.mockResolvedValue(mockHashedPassword as never);
      mockedJwt.sign.mockReturnValue('mock-token' as never);

      const result = await authService.register(mockEmail, mockPassword, existingTenantId);

      expect(result.user.tenant_id).toBe(existingTenantId);
    });
  });

  describe('login', () => {
    it('should login user successfully with valid credentials', async () => {
      const mockUser = {
        id: mockUserId,
        email: mockEmail,
        password_hash: mockHashedPassword,
        subscription_tier: 'free',
        tenant_id: mockTenantId
      };

      mockedDb.query.mockResolvedValue({
        rows: [mockUser],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedJwt.sign.mockReturnValue('login-token' as never);

      const result = await authService.login(mockEmail, mockPassword);

      expect(result.user.email).toBe(mockEmail);
      expect(result.user).not.toHaveProperty('password_hash');
      expect(result.token).toBe('login-token');
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(mockPassword, mockHashedPassword);
    });

    it('should throw error for non-existent user', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      await expect(authService.login(mockEmail, mockPassword))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw error for invalid password', async () => {
      const mockUser = {
        id: mockUserId,
        email: mockEmail,
        password_hash: mockHashedPassword,
        tenant_id: mockTenantId
      };

      mockedDb.query.mockResolvedValue({
        rows: [mockUser],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(authService.login(mockEmail, 'wrongpassword'))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      const mockUser = {
        id: mockUserId,
        email: mockEmail,
        subscription_tier: 'free',
        tenant_id: mockTenantId,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockedDb.query.mockResolvedValue({
        rows: [mockUser],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await authService.getUserById(mockUserId);

      expect(result).toEqual(mockUser);
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, email, subscription_tier'),
        [mockUserId]
      );
    });

    it('should return null for non-existent user', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await authService.getUserById(mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updates = {
        email: 'newemail@example.com',
        subscription_tier: 'premium' as const
      };

      const mockUpdatedUser = {
        id: mockUserId,
        ...updates,
        tenant_id: mockTenantId,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockedDb.query.mockResolvedValue({
        rows: [mockUpdatedUser],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      });

      const result = await authService.updateUser(mockUserId, updates);

      expect(result).toEqual(mockUpdatedUser);
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        [mockUserId, updates.email, updates.subscription_tier]
      );
    });

    it('should return null if user not found for update', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'UPDATE',
        oid: 0,
        fields: []
      });

      const result = await authService.updateUser(mockUserId, { email: 'new@example.com' });

      expect(result).toBeNull();
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockUser = {
        id: mockUserId,
        email: mockEmail,
        password_hash: mockHashedPassword
      };

      const newPassword = 'newpassword123';
      const newHashedPassword = '$2a$12$newhashedpassword';

      // Mock getting user
      mockedDb.query.mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock password update
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      });

      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedBcrypt.hash.mockResolvedValue(newHashedPassword as never);

      await authService.changePassword(mockUserId, mockPassword, newPassword);

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(mockPassword, mockHashedPassword);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(mockedDb.query).toHaveBeenLastCalledWith(
        expect.stringContaining('UPDATE users SET password_hash'),
        [newHashedPassword, mockUserId]
      );
    });

    it('should throw error for invalid current password', async () => {
      const mockUser = {
        id: mockUserId,
        password_hash: mockHashedPassword
      };

      mockedDb.query.mockResolvedValue({
        rows: [mockUser],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(authService.changePassword(mockUserId, 'wrongpassword', 'newpassword'))
        .rejects.toThrow('Invalid current password');
    });

    it('should throw error if user not found', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      await expect(authService.changePassword(mockUserId, mockPassword, 'newpassword'))
        .rejects.toThrow('User not found');
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token successfully', () => {
      const mockDecodedToken = {
        userId: mockUserId,
        email: mockEmail,
        tenantId: mockTenantId
      };

      mockedJwt.verify.mockReturnValue(mockDecodedToken as never);

      const result = authService.verifyToken('valid-token');

      expect(result).toEqual(mockDecodedToken);
      expect(mockedJwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
    });

    it('should throw error for invalid token', () => {
      mockedJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => authService.verifyToken('invalid-token'))
        .toThrow('Invalid token');
    });
  });

  describe('resetPassword', () => {
    it('should generate and set temporary password', async () => {
      const mockUser = {
        id: mockUserId,
        email: mockEmail,
        password_hash: mockHashedPassword
      };

      // Mock getting user
      mockedDb.query.mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Mock password update
      mockedDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      });

      mockedBcrypt.hash.mockResolvedValue('$2a$12$temphashedpassword' as never);

      const tempPassword = await authService.resetPassword(mockEmail);

      expect(tempPassword).toBeTruthy();
      expect(typeof tempPassword).toBe('string');
      expect(tempPassword.length).toBe(12);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(tempPassword, 12);
    });

    it('should throw error if user not found for reset', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      await expect(authService.resetPassword(mockEmail))
        .rejects.toThrow('User not found');
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 1,
        command: 'DELETE',
        oid: 0,
        fields: []
      });

      const result = await authService.deleteUser(mockUserId, mockTenantId);

      expect(result).toBe(true);
      expect(mockedDb.query).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = $1 AND tenant_id = $2',
        [mockUserId, mockTenantId]
      );
    });

    it('should return false if user not found for deletion', async () => {
      mockedDb.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'DELETE',
        oid: 0,
        fields: []
      });

      const result = await authService.deleteUser(mockUserId, mockTenantId);

      expect(result).toBe(false);
    });
  });

  describe('getTenantUsers', () => {
    it('should return all users for a tenant', async () => {
      const mockUsers = [
        {
          id: uuidv4(),
          email: 'user1@example.com',
          tenant_id: mockTenantId
        },
        {
          id: uuidv4(),
          email: 'user2@example.com',
          tenant_id: mockTenantId
        }
      ];

      mockedDb.query.mockResolvedValue({
        rows: mockUsers,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const result = await authService.getTenantUsers(mockTenantId);

      expect(result).toEqual(mockUsers);
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1'),
        [mockTenantId]
      );
    });
  });
});