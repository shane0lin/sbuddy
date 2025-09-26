import { Request, Response, NextFunction } from 'express';
import authService from '../services/authService';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    tenantId: string;
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const decoded = authService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireSubscription = (requiredTier: 'premium' | 'enterprise') => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const user = await authService.getUserById(req.user.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const tierLevels = { free: 0, premium: 1, enterprise: 2 };
      const userTierLevel = tierLevels[user.subscription_tier as keyof typeof tierLevels] || 0;
      const requiredTierLevel = tierLevels[requiredTier];

      if (userTierLevel < requiredTierLevel) {
        res.status(403).json({
          error: `${requiredTier} subscription required`,
          current_tier: user.subscription_tier,
          required_tier: requiredTier
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };
};

export const rateLimiter = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const identifier = req.user?.userId || req.ip;
    const now = Date.now();

    const userRequests = requests.get(identifier);

    if (!userRequests) {
      requests.set(identifier, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (now > userRequests.resetTime) {
      // Reset the window
      requests.set(identifier, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (userRequests.count >= maxRequests) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((userRequests.resetTime - now) / 1000)
      });
      return;
    }

    userRequests.count++;
    next();
  };
};