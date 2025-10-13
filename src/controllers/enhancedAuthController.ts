import { Request, Response } from 'express';
import enhancedAuthService from '../services/enhancedAuthService';
import gamificationService from '../services/gamificationService';
import Joi from 'joi';
import QRCode from 'qrcode';
import { AuthRequest } from '../middleware/auth';

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  tenantId: Joi.string().uuid().optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  tfaCode: Joi.string().length(6).optional(),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const resetPasswordRequestSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});

const verifyEmailSchema = Joi.object({
  token: Joi.string().required(),
});

export class EnhancedAuthController {
  // ===== Registration & Email Verification =====
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { email, password, tenantId } = value;
      const result = await enhancedAuthService.register(email, password, tenantId);

      res.status(201).json({
        message: result.message,
        user: result.user,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = verifyEmailSchema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const result = await enhancedAuthService.verifyEmail(value.token);

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async resendVerificationEmail(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const user = await enhancedAuthService.getUserById(req.user.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      if (user.email_verified) {
        res.status(400).json({ error: 'Email already verified' });
        return;
      }

      await enhancedAuthService.sendVerificationEmail(user.id, user.email);

      res.json({ message: 'Verification email sent' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ===== Login & Token Management =====
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { email, password, tfaCode } = value;
      const result = await enhancedAuthService.login(email, password, tfaCode);

      // Initialize gamification if new user
      try {
        await gamificationService.initializeUserScore(result.user.id);
      } catch (err) {
        // Ignore if already initialized
      }

      res.json({
        message: 'Login successful',
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      });
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = refreshTokenSchema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const tokens = await enhancedAuthService.refreshAccessToken(value.refreshToken);

      res.json({
        message: 'Token refreshed successfully',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        await enhancedAuthService.revokeRefreshToken(refreshToken);
      }

      res.json({ message: 'Logged out successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async logoutAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      await enhancedAuthService.revokeAllUserTokens(req.user.userId);

      res.json({ message: 'Logged out from all devices' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ===== Password Reset =====
  async requestPasswordReset(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = resetPasswordRequestSchema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const result = await enhancedAuthService.requestPasswordReset(value.email);

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = resetPasswordSchema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const result = await enhancedAuthService.resetPassword(value.token, value.newPassword);

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ===== OAuth =====
  async googleCallback(req: any, res: Response): Promise<void> {
    try {
      const { user, tokens } = req.user;

      // Redirect to frontend with tokens
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
      res.redirect(redirectUrl);
    } catch (error: any) {
      res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=${encodeURIComponent(error.message)}`);
    }
  }

  async appleCallback(req: any, res: Response): Promise<void> {
    try {
      const { user, tokens } = req.user;

      // Redirect to frontend with tokens
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
      res.redirect(redirectUrl);
    } catch (error: any) {
      res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=${encodeURIComponent(error.message)}`);
    }
  }

  // ===== Two-Factor Authentication =====
  async setup2FA(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const result = await enhancedAuthService.enable2FA(req.user.userId);

      // Generate QR code
      const qrCodeDataURL = await QRCode.toDataURL(result.qrCode);

      res.json({
        secret: result.secret,
        qrCode: qrCodeDataURL,
        message: 'Scan the QR code with your authenticator app',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async verify2FASetup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { token } = req.body;
      if (!token || token.length !== 6) {
        res.status(400).json({ error: 'Invalid 2FA token' });
        return;
      }

      const result = await enhancedAuthService.verify2FASetup(req.user.userId, token);

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async disable2FA(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { token } = req.body;
      if (!token || token.length !== 6) {
        res.status(400).json({ error: 'Invalid 2FA token' });
        return;
      }

      const result = await enhancedAuthService.disable2FA(req.user.userId, token);

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ===== User Profile =====
  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const user = await enhancedAuthService.getUserById(req.user.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const { password_hash, two_factor_secret, ...userWithoutSensitiveData } = user;

      res.json({ user: userWithoutSensitiveData });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const updateSchema = Joi.object({
        email: Joi.string().email().optional(),
        subscription_tier: Joi.string().valid('free', 'premium', 'enterprise').optional(),
      });

      const { error, value } = updateSchema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      // Only admins can change subscription tier
      if (value.subscription_tier && req.user.role !== 'admin') {
        delete value.subscription_tier;
      }

      const updatedUser = await enhancedAuthService.updateUser(req.user.userId, value);
      res.json({
        message: 'Profile updated successfully',
        user: updatedUser,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ===== GDPR Compliance =====
  async exportData(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const data = await enhancedAuthService.exportUserData(req.user.userId);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=user-data.json');
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { password } = req.body;

      const result = await enhancedAuthService.deleteUserAccount(req.user.userId, password);

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ===== Admin Only =====
  async updateUserRole(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const { userId, role } = req.body;

      if (!userId || !role) {
        res.status(400).json({ error: 'userId and role are required' });
        return;
      }

      if (!['user', 'admin', 'moderator'].includes(role)) {
        res.status(400).json({ error: 'Invalid role' });
        return;
      }

      const updatedUser = await enhancedAuthService.updateUser(userId, { role });

      res.json({
        message: 'User role updated successfully',
        user: updatedUser,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new EnhancedAuthController();
