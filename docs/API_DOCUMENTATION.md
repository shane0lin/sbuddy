# Sbuddy API Documentation

**Version**: 1.0.0
**Base URL**: `https://api.sbuddy.com/api/v1`
**Protocol**: HTTPS only
**Authentication**: JWT Bearer Token

---

## Table of Contents

1. [Authentication](#authentication)
2. [OCR & Problem Recognition](#ocr--problem-recognition)
3. [Problems](#problems)
4. [Study Sets](#study-sets)
5. [Spaced Repetition](#spaced-repetition)
6. [Gamification](#gamification)
7. [Payment](#payment)
8. [Error Handling](#error-handling)
9. [Rate Limits](#rate-limits)

---

## Authentication

### Register with Email
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response** (201):
```json
{
  "message": "Registration successful. Please verify your email.",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "email_verified": false
  }
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "tfa_code": "123456"  // Optional, only if 2FA enabled
}
```

**Response** (200):
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "subscription_tier": "free",
    "role": "user"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "15m"
  }
}
```

### Refresh Token
```http
POST /auth/refresh-token
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response** (200):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "15m"
}
```

### Google OAuth
```http
GET /auth/google
```
Redirects to Google OAuth consent screen.

**Callback**:
```http
GET /auth/google/callback?code=...
```
Returns tokens on success.

### Apple Sign-In
```http
GET /auth/apple
```
Redirects to Apple Sign-In.

### Verify Email
```http
POST /auth/verify-email
Content-Type: application/json

{
  "token": "email-verification-token"
}
```

### Logout
```http
POST /auth/logout
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Get Profile
```http
GET /auth/profile
Authorization: Bearer {accessToken}
```

**Response** (200):
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "subscription_tier": "premium",
    "role": "user",
    "email_verified": true,
    "two_factor_enabled": false,
    "created_at": "2025-10-12T00:00:00.000Z"
  }
}
```

### Enable 2FA
```http
POST /auth/2fa/setup
Authorization: Bearer {accessToken}
```

**Response** (200):
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,...",
  "message": "Scan QR code with authenticator app"
}
```

### Verify 2FA
```http
POST /auth/2fa/verify
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "token": "123456"
}
```

---

## OCR & Problem Recognition

### Process Single Image
```http
POST /ocr/process
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data

image: [File]
```

**Response** (200):
```json
{
  "ocr_result": {
    "success": true,
    "text": "Problem 1: If x + 2 = 5, what is x?",
    "confidence": 0.95,
    "problems_detected": 1,
    "problems": [
      {
        "text": "If x + 2 = 5, what is x?",
        "bbox": [10, 20, 100, 50],
        "confidence": 0.95
      }
    ]
  },
  "matches": [
    {
      "problem_id": "uuid",
      "similarity_score": 0.98,
      "match_type": "exact",
      "problem": {
        "id": "uuid",
        "title": "Basic Algebra Problem",
        "content": "If x + 2 = 5, what is x?",
        "source": "AMC 8",
        "exam_type": "AMC 8",
        "exam_year": 2023,
        "problem_number": 1,
        "difficulty": "easy",
        "subject": "Mathematics",
        "tags": ["algebra", "equations"]
      }
    }
  ],
  "detected_problems": 1
}
```

### Process Multiple Problems (AI-Enhanced)
```http
POST /ocr/process-multi
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data

image: [File]
```

**Response** (200):
```json
{
  "success": true,
  "total_problems": 3,
  "problems": [
    {
      "problem_number": 1,
      "text": "Problem 1 text...",
      "confidence": 0.95,
      "bbox": [10, 20, 100, 50],
      "matches": [...],
      "has_matches": true,
      "best_match": {...}
    },
    {
      "problem_number": 2,
      "text": "Problem 2 text...",
      "confidence": 0.92,
      "bbox": [10, 60, 100, 90],
      "matches": [...],
      "has_matches": false,
      "best_match": null
    }
  ],
  "ocr_confidence": 0.94
}
```

### Process Base64 Image
```http
POST /ocr/process-buffer
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "image_data": "base64-encoded-image-data",
  "filename": "problem.jpg"
}
```

### OCR Health Check
```http
GET /ocr/health
```

**Response** (200):
```json
{
  "status": "healthy",
  "ocr_service": "available"
}
```

---

## Problems

### Create Problem
```http
POST /problems
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "title": "Algebra Problem",
  "content": "If x + 2 = 5, what is x?",
  "source": "AMC 8",
  "category": "Algebra",
  "difficulty": "easy",
  "subject": "Mathematics",
  "exam_type": "AMC 8",
  "exam_year": 2023,
  "problem_number": 1,
  "tags": ["algebra", "equations"],
  "solution": "x = 3"
}
```

**Response** (201):
```json
{
  "message": "Problem created successfully",
  "problem": {
    "id": "uuid",
    "title": "Algebra Problem",
    "content": "If x + 2 = 5, what is x?",
    "source": "AMC 8",
    "category": "Algebra",
    "difficulty": "easy",
    "subject": "Mathematics",
    "exam_type": "AMC 8",
    "exam_year": 2023,
    "problem_number": 1,
    "tags": ["algebra", "equations"],
    "solution": "x = 3",
    "tenant_id": "uuid",
    "created_at": "2025-10-12T00:00:00.000Z",
    "updated_at": "2025-10-12T00:00:00.000Z"
  }
}
```

### Get Problem
```http
GET /problems/{id}
Authorization: Bearer {accessToken}
```

### Search Problems
```http
GET /problems/search?query=algebra&subject=Mathematics&difficulty=easy&limit=20&offset=0
Authorization: Bearer {accessToken}
```

**Query Parameters**:
- `query` (string): Search text
- `subject` (string): Filter by subject
- `category` (string): Filter by category
- `difficulty` (enum): easy, medium, hard
- `exam_type` (string): Filter by exam type
- `exam_year` (number): Filter by year
- `tags` (string): Comma-separated tags
- `limit` (number): Results per page (default: 20)
- `offset` (number): Pagination offset (default: 0)

**Response** (200):
```json
{
  "problems": [...],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

### Update Problem
```http
PUT /problems/{id}
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "title": "Updated Title",
  "difficulty": "medium"
}
```

### Delete Problem
```http
DELETE /problems/{id}
Authorization: Bearer {accessToken}
```

### Submit Answer
```http
POST /problems/{id}/answer
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "answer": "x = 3",
  "time_spent": 120
}
```

### Get Similar Problems
```http
GET /problems/{id}/similar?limit=5
Authorization: Bearer {accessToken}
```

### Bulk Import (Premium)
```http
POST /problems/bulk-import
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "problems": [
    {
      "title": "Problem 1",
      "content": "...",
      "source": "...",
      "category": "...",
      "difficulty": "easy",
      "subject": "Mathematics"
    }
  ]
}
```

### Import from CSV (Premium)
```http
POST /problems/import/csv
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "csv_content": "title,content,source,category,difficulty,subject\n...",
  "validate_only": false
}
```

**Response** (200):
```json
{
  "success": true,
  "total": 100,
  "imported": 95,
  "failed": 5,
  "errors": [
    {
      "row": 23,
      "error": "Invalid difficulty value",
      "data": {...}
    }
  ],
  "problems": [...]
}
```

### Import from JSON (Premium)
```http
POST /problems/import/json
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "json_content": "[{...}, {...}]",
  "validate_only": false
}
```

### Get Import Template
```http
GET /problems/import/template
Authorization: Bearer {accessToken}
```
Returns CSV template file.

### Get Import History
```http
GET /problems/import/history?limit=10
Authorization: Bearer {accessToken}
```

### Get Statistics
```http
GET /problems/statistics
Authorization: Bearer {accessToken}
```

**Response** (200):
```json
{
  "statistics": {
    "total_problems": 1500,
    "by_difficulty": {
      "easy": 500,
      "medium": 700,
      "hard": 300
    },
    "by_subject": {
      "Mathematics": 1000,
      "Physics": 300,
      "Chemistry": 200
    },
    "by_category": {
      "Algebra": 400,
      "Geometry": 300,
      "Calculus": 300
    }
  }
}
```

---

## Study Sets

### Create Study Set
```http
POST /study-sets
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "AMC 8 Practice",
  "description": "Problems for AMC 8 preparation",
  "is_public": false,
  "tags": ["amc8", "math", "algebra"]
}
```

**Response** (201):
```json
{
  "message": "Study set created successfully",
  "study_set": {
    "id": "uuid",
    "user_id": "uuid",
    "name": "AMC 8 Practice",
    "description": "Problems for AMC 8 preparation",
    "is_public": false,
    "tags": ["amc8", "math", "algebra"],
    "created_at": "2025-10-12T00:00:00.000Z",
    "updated_at": "2025-10-12T00:00:00.000Z"
  }
}
```

### Get User's Study Sets
```http
GET /study-sets
Authorization: Bearer {accessToken}
```

### Get Public Study Sets
```http
GET /study-sets/public?limit=50&offset=0
Authorization: Bearer {accessToken}
```

### Get Study Set
```http
GET /study-sets/{id}
Authorization: Bearer {accessToken}
```

### Update Study Set
```http
PUT /study-sets/{id}
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "Updated Name",
  "is_public": true
}
```

### Delete Study Set
```http
DELETE /study-sets/{id}
Authorization: Bearer {accessToken}
```

### Get Problems in Study Set
```http
GET /study-sets/{id}/problems
Authorization: Bearer {accessToken}
```

**Response** (200):
```json
{
  "problems": [
    {
      "id": "uuid",
      "title": "Algebra Problem",
      "content": "...",
      "difficulty": "easy",
      "custom_notes": "Review this problem again",
      "added_at": "2025-10-12T00:00:00.000Z"
    }
  ],
  "count": 25
}
```

### Add Problem to Study Set
```http
POST /study-sets/{id}/problems
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "problem_id": "uuid",
  "custom_notes": "Focus on this concept"
}
```

### Remove Problem from Study Set
```http
DELETE /study-sets/{id}/problems/{problemId}
Authorization: Bearer {accessToken}
```

### Bulk Add Problems
```http
POST /study-sets/{id}/problems/bulk
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "problem_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response** (200):
```json
{
  "message": "Bulk add completed: 25 added, 2 skipped",
  "added": 25,
  "skipped": 2
}
```

### Get Study Set Statistics
```http
GET /study-sets/{id}/stats
Authorization: Bearer {accessToken}
```

**Response** (200):
```json
{
  "statistics": {
    "total_problems": 50,
    "by_difficulty": {
      "easy": 20,
      "medium": 20,
      "hard": 10
    },
    "by_subject": {
      "Mathematics": 50
    },
    "avg_difficulty_rating": 2.3
  }
}
```

### Clone Study Set
```http
POST /study-sets/{id}/clone
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "My Copy of AMC 8 Practice"
}
```

---

## Spaced Repetition

### Get Due Cards
```http
GET /study/due-cards?limit=20
Authorization: Bearer {accessToken}
```

**Response** (200):
```json
{
  "due_cards": [
    {
      "id": "uuid",
      "problem_id": "uuid",
      "interval": 3,
      "repetitions": 2,
      "easiness": 2.5,
      "next_review": "2025-10-12T00:00:00.000Z",
      "problem": {
        "id": "uuid",
        "title": "Algebra Problem",
        "content": "..."
      }
    }
  ],
  "count": 15
}
```

### Review Card
```http
POST /study/review
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "card_id": "uuid",
  "quality": 4
}
```

**Quality Scale** (0-5):
- 0: Complete blackout
- 1: Incorrect but remembered
- 2: Incorrect but seemed easy
- 3: Correct but difficult
- 4: Correct with hesitation
- 5: Perfect recall

**Response** (200):
```json
{
  "message": "Review recorded",
  "card": {
    "id": "uuid",
    "interval": 7,
    "repetitions": 3,
    "easiness": 2.6,
    "next_review": "2025-10-19T00:00:00.000Z"
  }
}
```

### Get Upcoming Reviews
```http
GET /study/upcoming?days=7
Authorization: Bearer {accessToken}
```

**Response** (200):
```json
{
  "upcoming_reviews": {
    "2025-10-13": 5,
    "2025-10-14": 8,
    "2025-10-15": 3,
    "2025-10-16": 12
  }
}
```

### Get Study Statistics
```http
GET /study/statistics
Authorization: Bearer {accessToken}
```

**Response** (200):
```json
{
  "statistics": {
    "total_cards": 150,
    "mastered": 50,
    "learning": 75,
    "new": 25,
    "due_today": 15,
    "studied_today": 10,
    "streak_days": 7
  }
}
```

### Bulk Add to SRS
```http
POST /study/bulk-add
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "problem_ids": ["uuid1", "uuid2", "uuid3"]
}
```

---

## Gamification

### Get User Score
```http
GET /gamification/score
Authorization: Bearer {accessToken}
```

**Response** (200):
```json
{
  "score": {
    "user_id": "uuid",
    "total_points": 1250,
    "level": 8,
    "streak_days": 7,
    "longest_streak": 15,
    "problems_solved": 125,
    "achievements": [
      "first_problem",
      "week_streak",
      "100_problems",
      "master_algebra"
    ],
    "last_activity": "2025-10-12T10:30:00.000Z"
  }
}
```

### Get Leaderboard
```http
GET /gamification/leaderboard?limit=10
Authorization: Bearer {accessToken}
```

**Response** (200):
```json
{
  "leaderboard": [
    {
      "rank": 1,
      "user_id": "uuid",
      "email": "user@example.com",
      "total_points": 5000,
      "level": 25,
      "problems_solved": 500
    }
  ]
}
```

### Get Daily Challenge
```http
GET /gamification/daily-challenge
Authorization: Bearer {accessToken}
```

**Response** (200):
```json
{
  "challenge": {
    "id": "uuid",
    "date": "2025-10-12",
    "problem_id": "uuid",
    "bonus_points": 50,
    "problem": {...}
  },
  "progress": {
    "completed": false,
    "attempts": 0
  },
  "completed": false
}
```

---

## Payment

### Get Subscription Status
```http
GET /payment/status
Authorization: Bearer {accessToken}
```

**Response** (200):
```json
{
  "subscription": {
    "tier": "premium",
    "status": "active",
    "current_period_end": "2025-11-12T00:00:00.000Z",
    "cancel_at_period_end": false,
    "stripe_customer_id": "cus_...",
    "stripe_subscription_id": "sub_..."
  }
}
```

### Create Subscription
```http
POST /payment/create-subscription
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "price_id": "price_1234567890",
  "payment_method_id": "pm_1234567890"
}
```

### Cancel Subscription
```http
POST /payment/cancel-subscription
Authorization: Bearer {accessToken}
```

---

## Error Handling

All API errors follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful GET, PUT, DELETE |
| 201 | Created | Successful POST |
| 400 | Bad Request | Invalid input, validation errors |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 422 | Unprocessable Entity | OCR failed, invalid data |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | OCR service down |

### Common Errors

**Invalid Token**:
```json
{
  "error": "Invalid or expired token"
}
```

**Validation Error**:
```json
{
  "error": "Validation failed: title is required"
}
```

**Rate Limit**:
```json
{
  "error": "Rate limit exceeded. Try again in 60 seconds."
}
```

**Subscription Required**:
```json
{
  "error": "Premium subscription required for this feature"
}
```

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Auth (login, register) | 5 requests | 15 minutes |
| OCR processing | 10 requests | 1 minute |
| Problem creation | 30 requests | 1 minute |
| General API | 100 requests | 1 minute |

**Rate Limit Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1696262400
```

---

## Pagination

Endpoints that return lists support pagination:

**Request**:
```http
GET /problems/search?limit=20&offset=40
```

**Response**:
```json
{
  "problems": [...],
  "total": 500,
  "limit": 20,
  "offset": 40
}
```

---

## Webhooks

### Stripe Webhook
```http
POST /webhooks/stripe
Content-Type: application/json
Stripe-Signature: t=...,v1=...

{
  "type": "customer.subscription.updated",
  "data": {...}
}
```

Supported events:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

---

## SDK Examples

### JavaScript/TypeScript
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.sbuddy.com/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Login
const { data } = await api.post('/auth/login', {
  email: 'user@example.com',
  password: 'password123'
});

// Set token for subsequent requests
api.defaults.headers.common['Authorization'] = `Bearer ${data.tokens.accessToken}`;

// Upload image for OCR
const formData = new FormData();
formData.append('image', imageFile);
const ocrResult = await api.post('/ocr/process', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
```

### Swift (iOS)
```swift
import Foundation

struct SbuddyAPI {
    static let baseURL = "https://api.sbuddy.com/api/v1"
    var token: String?

    func login(email: String, password: String) async throws -> LoginResponse {
        guard let url = URL(string: "\(Self.baseURL)/auth/login") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["email": email, "password": password]
        request.httpBody = try JSONEncoder().encode(body)

        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode(LoginResponse.self, from: data)
    }

    func processImage(_ image: UIImage) async throws -> OCRResult {
        guard let url = URL(string: "\(Self.baseURL)/ocr/process"),
              let imageData = image.jpegData(compressionQuality: 0.8),
              let token = token else {
            throw APIError.invalidRequest
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.append("--\(boundary)\r\n")
        body.append("Content-Disposition: form-data; name=\"image\"; filename=\"photo.jpg\"\r\n")
        body.append("Content-Type: image/jpeg\r\n\r\n")
        body.append(imageData)
        body.append("\r\n--\(boundary)--\r\n")

        request.httpBody = body

        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode(OCRResult.self, from: data)
    }
}
```

### Kotlin (Android)
```kotlin
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*
import okhttp3.MultipartBody
import okhttp3.RequestBody

interface SbuddyAPI {
    @POST("auth/login")
    suspend fun login(@Body credentials: LoginRequest): LoginResponse

    @Multipart
    @POST("ocr/process")
    suspend fun processImage(
        @Header("Authorization") token: String,
        @Part image: MultipartBody.Part
    ): OCRResult

    @GET("study/due-cards")
    suspend fun getDueCards(
        @Header("Authorization") token: String,
        @Query("limit") limit: Int = 20
    ): DueCardsResponse
}

class SbuddyClient {
    private val api = Retrofit.Builder()
        .baseUrl("https://api.sbuddy.com/api/v1/")
        .addConverterFactory(GsonConverterFactory.create())
        .build()
        .create(SbuddyAPI::class.java)

    var token: String? = null

    suspend fun login(email: String, password: String): LoginResponse {
        val response = api.login(LoginRequest(email, password))
        token = response.tokens.accessToken
        return response
    }

    suspend fun processImage(imageFile: File): OCRResult {
        val requestFile = RequestBody.create(
            MediaType.parse("image/*"),
            imageFile
        )
        val body = MultipartBody.Part.createFormData("image", imageFile.name, requestFile)
        return api.processImage("Bearer $token", body)
    }
}
```

---

## Testing

**Test Server**: `https://api-staging.sbuddy.com/api/v1`

**Test Credentials**:
- Email: `test@sbuddy.com`
- Password: `TestPassword123!`

**Test Stripe Cards**:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`

---

## Support

- **Documentation**: https://docs.sbuddy.com
- **Status Page**: https://status.sbuddy.com
- **Support Email**: support@sbuddy.com
- **GitHub Issues**: https://github.com/sbuddy/api/issues

---

## Changelog

### Version 1.0.0 (2025-10-12)
- Initial API release
- Full authentication system
- OCR with multi-problem detection
- Study sets and spaced repetition
- Gamification system
- Payment integration
