# Authentication System Documentation

## Overview

Sbuddy implements a comprehensive authentication system with the following features:

- **Email/Password Authentication** with email verification
- **OAuth 2.0** (Google and Apple Sign-In)
- **JWT-based tokens** with refresh token rotation
- **Two-Factor Authentication (2FA)** using TOTP
- **Password reset** with secure tokens
- **Role-Based Access Control (RBAC)**
- **GDPR compliance** (data export and account deletion)
- **Multi-tenancy** support

---

## Authentication Flow

### 1. Email/Password Registration

**Endpoint**: `POST /api/v1/auth/register`

**Request**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response**:
```json
{
  "message": "Registration successful. Please check your email to verify your account.",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "subscription_tier": "free",
    "email_verified": false,
    "role": "user"
  }
}
```

**Flow**:
1. User submits registration form
2. System creates user account with `email_verified: false`
3. Verification email sent with token (valid for 24 hours)
4. User clicks link in email to verify account

---

### 2. Email Verification

**Endpoint**: `POST /api/v1/auth/verify-email`

**Request**:
```json
{
  "token": "verification-token-from-email"
}
```

**Response**:
```json
{
  "message": "Email verified successfully"
}
```

---

### 3. Login

**Endpoint**: `POST /api/v1/auth/login`

**Request**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "tfaCode": "123456"  // Optional, required if 2FA enabled
}
```

**Response**:
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "subscription_tier": "free",
    "role": "user"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Token Details**:
- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (7 days), used to obtain new access tokens

---

### 4. Token Refresh

**Endpoint**: `POST /api/v1/auth/refresh-token`

**Request**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response**:
```json
{
  "message": "Token refreshed successfully",
  "accessToken": "new-access-token",
  "refreshToken": "new-refresh-token"
}
```

**Security**: Old refresh token is invalidated when new tokens are issued (refresh token rotation).

---

## OAuth 2.0 Integration

### Google Sign-In

**Flow**:
1. Frontend redirects to: `GET /api/v1/auth/google`
2. User authenticates with Google
3. Google redirects to: `GET /api/v1/auth/google/callback`
4. Backend redirects to frontend with tokens: `/auth/callback?accessToken=...&refreshToken=...`

**Configuration**:
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Apple Sign-In

**Flow**:
1. Frontend redirects to: `GET /api/v1/auth/apple`
2. User authenticates with Apple
3. Apple redirects to: `POST /api/v1/auth/apple/callback`
4. Backend redirects to frontend with tokens

**Configuration**:
```env
APPLE_CLIENT_ID=your-apple-client-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY=your-apple-private-key
```

---

## Two-Factor Authentication (2FA)

### Enable 2FA

**Endpoint**: `POST /api/v1/auth/2fa/setup`

**Headers**: `Authorization: Bearer <access-token>`

**Response**:
```json
{
  "secret": "BASE32ENCODEDSECRET",
  "qrCode": "data:image/png;base64,...",
  "message": "Scan the QR code with your authenticator app"
}
```

### Verify 2FA Setup

**Endpoint**: `POST /api/v1/auth/2fa/verify`

**Request**:
```json
{
  "token": "123456"
}
```

**Response**:
```json
{
  "message": "2FA enabled successfully"
}
```

### Disable 2FA

**Endpoint**: `POST /api/v1/auth/2fa/disable`

**Request**:
```json
{
  "token": "123456"
}
```

---

## Password Reset

### Request Password Reset

**Endpoint**: `POST /api/v1/auth/password-reset/request`

**Request**:
```json
{
  "email": "user@example.com"
}
```

**Response**:
```json
{
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

**Security**: Response is same whether user exists or not (prevents user enumeration).

### Confirm Password Reset

**Endpoint**: `POST /api/v1/auth/password-reset/confirm`

**Request**:
```json
{
  "token": "reset-token-from-email",
  "newPassword": "newSecurePassword123"
}
```

**Response**:
```json
{
  "message": "Password reset successful"
}
```

**Security**: All refresh tokens are revoked after password reset.

---

## Role-Based Access Control (RBAC)

### Roles

- **user**: Default role, access to basic features
- **moderator**: Can moderate content, view reports
- **admin**: Full system access, can manage users and roles

### Using RBAC in Routes

```typescript
import { authenticateToken, requireRole } from '../middleware/auth';

// Require authentication
router.get('/profile', authenticateToken, handler);

// Require specific role
router.delete('/users/:id', authenticateToken, requireRole(['admin']), handler);

// Multiple allowed roles
router.get('/reports', authenticateToken, requireRole(['admin', 'moderator']), handler);
```

### Update User Role (Admin Only)

**Endpoint**: `PATCH /api/v1/auth/users/:userId/role`

**Headers**: `Authorization: Bearer <admin-access-token>`

**Request**:
```json
{
  "userId": "user-uuid",
  "role": "moderator"
}
```

---

## User Profile Management

### Get Profile

**Endpoint**: `GET /api/v1/auth/profile`

**Headers**: `Authorization: Bearer <access-token>`

**Response**:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "subscription_tier": "premium",
    "email_verified": true,
    "role": "user",
    "two_factor_enabled": true
  }
}
```

### Update Profile

**Endpoint**: `PATCH /api/v1/auth/profile`

**Request**:
```json
{
  "email": "newemail@example.com"
}
```

---

## GDPR Compliance

### Export User Data

**Endpoint**: `GET /api/v1/auth/export-data`

**Headers**: `Authorization: Bearer <access-token>`

**Response**: JSON file download containing all user data:
```json
{
  "user": { ... },
  "progress": [ ... ],
  "study_sessions": [ ... ],
  "spaced_repetition_cards": [ ... ],
  "scores": [ ... ]
}
```

### Delete Account

**Endpoint**: `DELETE /api/v1/auth/account`

**Request**:
```json
{
  "password": "currentPassword"  // Required for password-based accounts
}
```

**Response**:
```json
{
  "message": "Account deleted successfully"
}
```

**Warning**: This action is irreversible and deletes all user data.

---

## Logout

### Logout (Single Device)

**Endpoint**: `POST /api/v1/auth/logout`

**Request**:
```json
{
  "refreshToken": "current-refresh-token"
}
```

### Logout All Devices

**Endpoint**: `POST /api/v1/auth/logout-all`

**Headers**: `Authorization: Bearer <access-token>`

**Effect**: Revokes all refresh tokens for the user.

---

## Security Best Practices

### Token Storage

**Frontend**:
- Store access token in memory (React state, Vuex store)
- Store refresh token in httpOnly cookie or secure storage
- Never store tokens in localStorage (XSS vulnerability)

### Making Authenticated Requests

```javascript
// Include access token in Authorization header
fetch('/api/v1/profile', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

// Handle token expiration
if (response.status === 403) {
  // Refresh token
  const newTokens = await refreshAccessToken(refreshToken);
  // Retry request with new access token
}
```

### Password Requirements

- Minimum 8 characters
- Recommend: Mix of uppercase, lowercase, numbers, and symbols
- Passwords are hashed with bcrypt (cost factor: 12)

### Rate Limiting

- Login attempts: 5 per minute per IP
- Password reset: 3 per hour per email
- 2FA verification: 5 per minute per user

---

## Email Configuration

### SMTP Setup (Gmail Example)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
SMTP_FROM=noreply@sbuddy.com
```

**Note**: For Gmail, you need to create an [App Password](https://support.google.com/accounts/answer/185833).

### Email Templates

The system sends emails for:
- Email verification
- Password reset
- Account security alerts (future)

Templates are defined in `src/services/enhancedAuthService.ts`.

---

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  subscription_tier VARCHAR(50) DEFAULT 'free',
  tenant_id UUID REFERENCES tenants(id),
  email_verified BOOLEAN DEFAULT FALSE,
  oauth_provider VARCHAR(50),
  oauth_id VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  two_factor_secret VARCHAR(255),
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Refresh Tokens Table

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Email Verification Tokens Table

```sql
CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Password Reset Tokens Table

```sql
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Testing

Run authentication tests:

```bash
npm test tests/services/enhancedAuthService.test.ts
```

### Test Coverage

- ✅ User registration
- ✅ Email verification
- ✅ Login with password
- ✅ Login with 2FA
- ✅ Token refresh
- ✅ Password reset
- ✅ OAuth integration
- ✅ GDPR data export
- ✅ Account deletion
- ✅ RBAC permissions

---

## Troubleshooting

### "Email not verified" error

**Solution**: Check your email for verification link, or request a new one:
```
POST /api/v1/auth/resend-verification
```

### OAuth redirect issues

**Solution**: Verify callback URLs in OAuth provider settings:
- Google: `http://localhost:3000/api/v1/auth/google/callback`
- Apple: `http://localhost:3000/api/v1/auth/apple/callback`

### 2FA code not working

**Solution**:
- Ensure device time is synchronized
- TOTP codes are time-sensitive (valid for 30 seconds)
- Window of 2 intervals allowed (±60 seconds)

### Refresh token expired

**Solution**: User must log in again. Refresh tokens expire after 7 days of inactivity.

---

## API Error Codes

| Status Code | Error | Meaning |
|-------------|-------|---------|
| 400 | `User already exists` | Email already registered |
| 401 | `Invalid credentials` | Wrong email or password |
| 401 | `2FA code required` | User has 2FA enabled |
| 403 | `Email not verified` | User must verify email first |
| 403 | `Invalid token` | Access token expired or invalid |
| 403 | `Insufficient permissions` | User role doesn't have access |
| 429 | `Rate limit exceeded` | Too many requests |

---

## Future Enhancements

- [ ] Biometric authentication (Face ID, Touch ID)
- [ ] WebAuthn/FIDO2 support
- [ ] Magic link authentication (passwordless)
- [ ] Session management dashboard
- [ ] Account activity log
- [ ] Suspicious login detection
- [ ] IP-based geolocation restrictions
- [ ] Remember device feature
- [ ] Social login (Facebook, GitHub, Twitter)

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/sbuddy/issues
- Email: support@sbuddy.com
