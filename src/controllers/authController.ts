import { Request, Response } from 'express';
import authService from '../services/authService';
import gamificationService from '../services/gamificationService';
import Joi from 'joi';

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  tenantId: Joi.string().uuid().optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { email, password, tenantId } = value;
      const result = await authService.register(email, password, tenantId);

      // Initialize user scoring
      await gamificationService.initializeUserScore(result.user.id);

      res.status(201).json({
        message: 'User registered successfully',
        user: result.user,
        token: result.token
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { email, password } = value;
      const result = await authService.login(email, password);

      res.json({
        message: 'Login successful',
        user: result.user,
        token: result.token
      });
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  async getProfile(req: any, res: Response): Promise<void> {
    try {
      const user = await authService.getUserById(req.user.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ user });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateProfile(req: any, res: Response): Promise<void> {
    try {
      const updateSchema = Joi.object({
        email: Joi.string().email().optional(),
        subscription_tier: Joi.string().valid('free', 'premium', 'enterprise').optional()
      });

      const { error, value } = updateSchema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const updatedUser = await authService.updateUser(req.user.userId, value);
      res.json({
        message: 'Profile updated successfully',
        user: updatedUser
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async changePassword(req: any, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: Joi.string().min(8).required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      await authService.changePassword(req.user.userId, value.currentPassword, value.newPassword);
      res.json({ message: 'Password changed successfully' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

export default new AuthController();