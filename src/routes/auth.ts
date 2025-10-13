import express from 'express';
import enhancedAuthController from '../controllers/enhancedAuthController';
import { authenticateToken, requireRole } from '../middleware/auth';
import passport from '../config/passport';

const router = express.Router();

// ===== Public Routes =====

// Registration & Email Verification
router.post('/register', (req, res) => enhancedAuthController.register(req, res));
router.post('/verify-email', (req, res) => enhancedAuthController.verifyEmail(req, res));

// Login & Token Management
router.post('/login', (req, res) => enhancedAuthController.login(req, res));
router.post('/refresh-token', (req, res) => enhancedAuthController.refreshToken(req, res));
router.post('/logout', (req, res) => enhancedAuthController.logout(req, res));

// Password Reset
router.post('/password-reset/request', (req, res) => enhancedAuthController.requestPasswordReset(req, res));
router.post('/password-reset/confirm', (req, res) => enhancedAuthController.resetPassword(req, res));

// OAuth - Google
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/auth/error` }),
  (req, res) => enhancedAuthController.googleCallback(req, res)
);

// OAuth - Apple
router.get(
  '/apple',
  passport.authenticate('apple', { session: false })
);
router.post(
  '/apple/callback',
  passport.authenticate('apple', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/auth/error` }),
  (req, res) => enhancedAuthController.appleCallback(req, res)
);

// ===== Protected Routes (Require Authentication) =====

// Email Verification
router.post('/resend-verification', authenticateToken, (req: any, res) =>
  enhancedAuthController.resendVerificationEmail(req, res)
);

// Logout from all devices
router.post('/logout-all', authenticateToken, (req: any, res) =>
  enhancedAuthController.logoutAll(req, res)
);

// Two-Factor Authentication
router.post('/2fa/setup', authenticateToken, (req: any, res) =>
  enhancedAuthController.setup2FA(req, res)
);
router.post('/2fa/verify', authenticateToken, (req: any, res) =>
  enhancedAuthController.verify2FASetup(req, res)
);
router.post('/2fa/disable', authenticateToken, (req: any, res) =>
  enhancedAuthController.disable2FA(req, res)
);

// User Profile
router.get('/profile', authenticateToken, (req: any, res) =>
  enhancedAuthController.getProfile(req, res)
);
router.patch('/profile', authenticateToken, (req: any, res) =>
  enhancedAuthController.updateProfile(req, res)
);

// GDPR Compliance
router.get('/export-data', authenticateToken, (req: any, res) =>
  enhancedAuthController.exportData(req, res)
);
router.delete('/account', authenticateToken, (req: any, res) =>
  enhancedAuthController.deleteAccount(req, res)
);

// ===== Admin Routes =====

router.patch('/users/:userId/role',
  authenticateToken,
  requireRole(['admin']),
  (req: any, res) => enhancedAuthController.updateUserRole(req, res)
);

export default router;
