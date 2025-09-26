# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sbuddy** is an AI-powered problem recognition and study system that allows users to take photos of problems, convert them to text using OCR, identify problems from a repository, and study them using spaced repetition with gamification elements.

## Development Commands

### Essential Commands
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm test` - Run Jest tests
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript compiler check

### Database Commands
- Database initialization happens automatically on server start
- Tables are created/verified in `src/models/database.ts`

### Testing Individual Components
- Test OCR service: `curl http://localhost:3000/api/v1/ocr/health`
- Test auth: `curl http://localhost:3000/api/v1/health`

## System Architecture

### Core Modules

1. **OCR Service** (`src/services/ocrService.ts`)
   - Integrates with Surya OCR for photo-to-text conversion
   - Detects multiple problems in single images
   - Handles both file uploads and base64 image data

2. **Problem Repository** (`src/services/problemRepository.ts`)
   - Manages CRUD operations for problems
   - Full-text search with PostgreSQL
   - Categorization by exam type, subject, difficulty
   - Bulk import capabilities

3. **Problem Matcher** (`src/services/problemMatcher.ts`)
   - AI-powered problem identification using OpenAI GPT-4
   - Similarity scoring and ranking
   - Fallback to basic text matching if AI unavailable

4. **Spaced Repetition** (`src/services/spacedRepetition.ts`)
   - SM-2 algorithm implementation for optimal review scheduling
   - Tracks user progress and mastery levels
   - Due cards and upcoming reviews

5. **Gamification System** (`src/services/gamificationService.ts`)
   - Points, levels, streaks, and achievements
   - Leaderboards and daily challenges
   - Time bonuses and difficulty multipliers

6. **Multi-tenancy & Auth** (`src/services/authService.ts`)
   - JWT-based authentication
   - Tenant isolation for enterprise use
   - Subscription tier management

7. **Payment Integration** (`src/services/paymentService.ts`)
   - Stripe integration for subscriptions
   - Webhook handling for payment events
   - Subscription tier enforcement

### Database Schema

**Core Tables:**
- `users` - User accounts with tenant association
- `tenants` - Organization/tenant management
- `problems` - Problem repository with metadata
- `user_progress` - Individual progress tracking
- `spaced_repetition_cards` - SRS scheduling data
- `user_scores` - Gamification scores and achievements

**Key Relationships:**
- Users belong to tenants (multi-tenancy)
- Problems are tenant-scoped
- Progress tracking links users to problems
- SRS cards manage review scheduling per user-problem pair

### API Architecture

**RESTful endpoints** at `/api/v1/`:
- `/auth/*` - Authentication and user management
- `/problems/*` - Problem CRUD and search
- `/ocr/*` - Image processing and OCR
- `/study/*` - Spaced repetition system
- `/gamification/*` - Scoring and achievements
- `/payment/*` - Subscription management
- `/webhooks/stripe` - Stripe payment webhooks

### Key Design Patterns

1. **Service Layer Pattern** - Business logic separated into services
2. **Repository Pattern** - Data access abstraction
3. **Middleware Pattern** - Auth, rate limiting, validation
4. **Multi-tenancy** - Data isolation by tenant_id
5. **Rate Limiting** - Per-user request throttling
6. **Subscription Gating** - Feature access by subscription tier

### Environment Configuration

Required environment variables:
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
STRIPE_SECRET_KEY=...
OPENAI_API_KEY=...
OCR_SERVICE_URL=...
```

### External Dependencies

- **PostgreSQL** - Primary database with full-text search
- **Redis** - Caching and session storage
- **Surya OCR** - External OCR service for image processing
- **OpenAI API** - Problem matching and AI features
- **Stripe** - Payment processing

## Development Notes

- All services use dependency injection pattern
- Database queries use parameterized statements (SQL injection protection)
- File uploads are validated and cleaned up automatically
- Rate limiting prevents abuse of expensive operations (OCR, AI)
- Multi-tenant data isolation enforced at query level
- Comprehensive error handling with appropriate HTTP status codes