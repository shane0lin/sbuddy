import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, redis } from '../models/database';
import { User, RefreshToken, EmailVerificationToken, PasswordResetToken } from '../types';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import nodemailer from 'nodemailer';
import config from '../config/env';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class EnhancedAuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;
  private readonly emailTransporter: nodemailer.Transporter;

  constructor() {
    this.jwtSecret = config.JWT_SECRET;
    this.jwtRefreshSecret = config.JWT_REFRESH_SECRET;
    this.accessTokenExpiresIn = config.JWT_EXPIRES_IN;
    this.refreshTokenExpiresIn = config.JWT_REFRESH_EXPIRES_IN;

    // Email configuration
    this.emailTransporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });
  }

  // ===== Registration with Email Verification =====
  async register(email: string, password: string, tenantId?: string): Promise<{
    user: Omit<User, 'password_hash'>;
    message: string;
  }> {
    const existingUser = await this.getUserByEmail(email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create tenant if not provided
    let finalTenantId = tenantId;
    if (!finalTenantId) {
      finalTenantId = await this.createTenant(email.split('@')[1] || 'default');
    }

    const query = `
      INSERT INTO users (id, email, password_hash, tenant_id, email_verified, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, subscription_tier, tenant_id, email_verified, role, created_at, updated_at
    `;

    const userId = uuidv4();
    const values = [userId, email, passwordHash, finalTenantId, false, 'user'];
    const result = await db.query(query, values);
    const user = result.rows[0];

    // Send verification email
    await this.sendVerificationEmail(userId, email);

    return {
      user,
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  // ===== Email Verification =====
  async sendVerificationEmail(userId: string, email: string): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const query = `
      INSERT INTO email_verification_tokens (id, user_id, token, expires_at)
      VALUES ($1, $2, $3, $4)
    `;
    await db.query(query, [uuidv4(), userId, token, expiresAt]);

    const verificationUrl = `${config.FRONTEND_URL}/verify-email?token=${token}`;

    await this.emailTransporter.sendMail({
      from: config.SMTP_FROM,
      to: email,
      subject: 'Verify Your Email - Sbuddy',
      html: `
        <h1>Welcome to Sbuddy!</h1>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verificationUrl}">${verificationUrl}</a>
        <p>This link will expire in 24 hours.</p>
      `,
    });
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const query = `
      SELECT * FROM email_verification_tokens
      WHERE token = $1 AND expires_at > NOW()
    `;
    const result = await db.query(query, [token]);

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired verification token');
    }

    const verificationToken = result.rows[0];

    // Update user email_verified status
    await db.query(
      'UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1',
      [verificationToken.user_id]
    );

    // Delete used token
    await db.query('DELETE FROM email_verification_tokens WHERE id = $1', [verificationToken.id]);

    return { message: 'Email verified successfully' };
  }

  // ===== Login with Refresh Tokens =====
  async login(email: string, password: string, tfaCode?: string): Promise<{
    user: Omit<User, 'password_hash'>;
    tokens: TokenPair;
  }> {
    const user = await this.getUserByEmail(email);
    if (!user || !user.password_hash) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    if (!user.email_verified) {
      throw new Error('Please verify your email before logging in');
    }

    // Check 2FA if enabled
    if (user.two_factor_enabled && user.two_factor_secret) {
      if (!tfaCode) {
        throw new Error('2FA code required');
      }

      const isValid = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token: tfaCode,
        window: 2,
      });

      if (!isValid) {
        throw new Error('Invalid 2FA code');
      }
    }

    const tokens = await this.generateTokenPair(user.id, user.email, user.tenant_id, user.role);
    const { password_hash, two_factor_secret, ...userWithoutSensitiveData } = user;

    return { user: userWithoutSensitiveData, tokens };
  }

  // ===== Refresh Token Management =====
  async generateTokenPair(
    userId: string,
    email: string,
    tenantId: string,
    role: string
  ): Promise<TokenPair> {
    const accessToken = jwt.sign(
      { userId, email, tenantId, role },
      this.jwtSecret,
      { expiresIn: this.accessTokenExpiresIn } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { userId, email, type: 'refresh' },
      this.jwtRefreshSecret,
      { expiresIn: this.refreshTokenExpiresIn } as jwt.SignOptions
    );

    // Store refresh token in database
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await db.query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [uuidv4(), userId, refreshToken, expiresAt]
    );

    return { accessToken, refreshToken };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret) as any;

      // Check if refresh token exists in database and is not expired
      const result = await db.query(
        `SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()`,
        [refreshToken]
      );

      if (result.rows.length === 0) {
        throw new Error('Invalid refresh token');
      }

      const user = await this.getUserById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Delete old refresh token
      await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);

      // Generate new token pair
      return await this.generateTokenPair(user.id, user.email, user.tenant_id, user.role);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
  }

  // ===== Password Reset =====
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      return { message: 'If an account with that email exists, a password reset link has been sent.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const query = `
      INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
      VALUES ($1, $2, $3, $4)
    `;
    await db.query(query, [uuidv4(), user.id, token, expiresAt]);

    const resetUrl = `${config.FRONTEND_URL}/reset-password?token=${token}`;

    await this.emailTransporter.sendMail({
      from: config.SMTP_FROM,
      to: email,
      subject: 'Password Reset - Sbuddy',
      html: `
        <h1>Password Reset Request</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });

    return { message: 'If an account with that email exists, a password reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const query = `
      SELECT * FROM password_reset_tokens
      WHERE token = $1 AND expires_at > NOW() AND used = FALSE
    `;
    const result = await db.query(query, [token]);

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired reset token');
    }

    const resetToken: PasswordResetToken = result.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, resetToken.user_id]
    );

    // Mark token as used
    await db.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [resetToken.id]);

    // Revoke all refresh tokens for security
    await this.revokeAllUserTokens(resetToken.user_id);

    return { message: 'Password reset successful' };
  }

  // ===== OAuth Integration =====
  async findOrCreateOAuthUser(
    email: string,
    provider: 'google' | 'apple',
    oauthId: string,
    tenantId?: string
  ): Promise<{
    user: Omit<User, 'password_hash'>;
    tokens: TokenPair;
    isNewUser: boolean;
  }> {
    // Check if user exists with OAuth
    let user = await this.getUserByOAuth(provider, oauthId);

    if (!user) {
      // Check if user exists with email
      user = await this.getUserByEmail(email);

      if (user) {
        // Link OAuth to existing account
        await db.query(
          'UPDATE users SET oauth_provider = $1, oauth_id = $2, email_verified = TRUE WHERE id = $3',
          [provider, oauthId, user.id]
        );
      } else {
        // Create new user
        let finalTenantId = tenantId;
        if (!finalTenantId) {
          finalTenantId = await this.createTenant(email.split('@')[1] || 'default');
        }

        const query = `
          INSERT INTO users (id, email, tenant_id, email_verified, oauth_provider, oauth_id, role)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `;

        const userId = uuidv4();
        const result = await db.query(query, [
          userId,
          email,
          finalTenantId,
          true,
          provider,
          oauthId,
          'user',
        ]);
        user = result.rows[0];
      }
    }

    if (!user) {
      throw new Error('Failed to create or find user');
    }

    const tokens = await this.generateTokenPair(user.id, user.email, user.tenant_id, user.role);
    const { password_hash, two_factor_secret, ...userWithoutSensitiveData } = user;

    return {
      user: userWithoutSensitiveData,
      tokens,
      isNewUser: !password_hash && !two_factor_secret,
    };
  }

  private async getUserByOAuth(provider: string, oauthId: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2';
    const result = await db.query(query, [provider, oauthId]);
    return result.rows[0] || null;
  }

  // ===== Two-Factor Authentication =====
  async enable2FA(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `Sbuddy (${user.email})`,
      length: 32,
    });

    // Store secret temporarily (will be confirmed when user verifies)
    await db.query(
      'UPDATE users SET two_factor_secret = $1 WHERE id = $2',
      [secret.base32, userId]
    );

    return {
      secret: secret.base32,
      qrCode: secret.otpauth_url || '',
    };
  }

  async verify2FASetup(userId: string, token: string): Promise<{ message: string }> {
    const user = await this.getUserById(userId);
    if (!user || !user.two_factor_secret) {
      throw new Error('2FA setup not initiated');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!isValid) {
      throw new Error('Invalid 2FA code');
    }

    await db.query(
      'UPDATE users SET two_factor_enabled = TRUE WHERE id = $1',
      [userId]
    );

    return { message: '2FA enabled successfully' };
  }

  async disable2FA(userId: string, token: string): Promise<{ message: string }> {
    const user = await this.getUserById(userId);
    if (!user || !user.two_factor_enabled || !user.two_factor_secret) {
      throw new Error('2FA not enabled');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!isValid) {
      throw new Error('Invalid 2FA code');
    }

    await db.query(
      'UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = $1',
      [userId]
    );

    return { message: '2FA disabled successfully' };
  }

  // ===== GDPR Compliance =====
  async exportUserData(userId: string): Promise<any> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Fetch all user-related data
    const [progressResult, sessionsResult, cardsResult, scoresResult] = await Promise.all([
      db.query('SELECT * FROM user_progress WHERE user_id = $1', [userId]),
      db.query('SELECT * FROM study_sessions WHERE user_id = $1', [userId]),
      db.query('SELECT * FROM spaced_repetition_cards WHERE user_id = $1', [userId]),
      db.query('SELECT * FROM user_scores WHERE user_id = $1', [userId]),
    ]);

    return {
      user: {
        id: user.id,
        email: user.email,
        subscription_tier: user.subscription_tier,
        email_verified: user.email_verified,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      progress: progressResult.rows,
      study_sessions: sessionsResult.rows,
      spaced_repetition_cards: cardsResult.rows,
      scores: scoresResult.rows,
    };
  }

  async deleteUserAccount(userId: string, password?: string): Promise<{ message: string }> {
    const user = await this.getUserByEmail(userId);

    if (user && user.password_hash && password) {
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error('Invalid password');
      }
    }

    // Delete user (CASCADE will handle related data)
    await db.query('DELETE FROM users WHERE id = $1', [userId]);

    return { message: 'Account deleted successfully' };
  }

  // ===== User Management =====
  async getUserById(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await db.query(query, [email]);
    return result.rows[0] || null;
  }

  async updateUser(
    id: string,
    updates: Partial<Pick<User, 'email' | 'subscription_tier' | 'role'>>
  ): Promise<Omit<User, 'password_hash' | 'two_factor_secret'> | null> {
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const query = `
      UPDATE users
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email, subscription_tier, tenant_id, email_verified, oauth_provider, oauth_id, role, two_factor_enabled, created_at, updated_at
    `;

    const values = [id, ...Object.values(updates)];
    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  verifyToken(token: string): { userId: string; email: string; tenantId: string; role: string } {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      return {
        userId: decoded.userId,
        email: decoded.email,
        tenantId: decoded.tenantId,
        role: decoded.role,
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  private async createTenant(name: string): Promise<string> {
    const query = `
      INSERT INTO tenants (id, name)
      VALUES ($1, $2)
      RETURNING id
    `;

    const tenantId = uuidv4();
    const result = await db.query(query, [tenantId, name]);
    return result.rows[0].id;
  }
}

export default new EnhancedAuthService();
