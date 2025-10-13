# Sbuddy Implementation Plan

## Overview
This document outlines the detailed implementation plan for all features specified in `feature.md`. The plan is organized into 13 phases, covering backend services, authentication, payment integration, spaced repetition, gamification, and multi-platform client applications.

---

## Phase 1: Core OCR & Problem Recognition

**Feature Reference**: docs/feature.md:2, docs/feature.md:6

**Objective**: Enable photo-to-text conversion with multi-problem detection capability.

### Tasks
- [ ] Integrate Surya OCR service (https://github.com/datalab-to/surya)
- [ ] Build image preprocessing pipeline (resize, contrast enhancement, deskewing)
- [ ] Implement multi-problem detection algorithm within single images
- [ ] Create OCR result parser to structure extracted text
- [ ] Add image validation and format support (JPEG, PNG, HEIC)
- [ ] Build error handling for poor quality images
- [ ] Implement asynchronous OCR processing for large images

### Technical Stack
- Surya OCR (Python service)
- Node.js bridge to Python OCR service
- Sharp/Jimp for image preprocessing
- REST API endpoint for image upload

### Acceptance Criteria
- Successfully convert image to text with >90% accuracy on clear images
- Detect and separate multiple problems in a single photo
- Handle images up to 10MB in size
- Return structured JSON with problem boundaries and text

---

## Phase 2: Problem Repository System

**Feature Reference**: docs/feature.md:3

**Objective**: Build a comprehensive problem storage system with standardized naming convention.

### Tasks
- [ ] Design database schema for problems table with comprehensive metadata
- [ ] Implement standardized naming format: `{EXAM}-{YEAR}-{VARIANT}-{NUMBER}` (e.g., AMC10-2025-A-01)
- [ ] Build CRUD API endpoints for problem management
- [ ] Add metadata fields:
  - Exam type (AMC10, AMC12, AIME, USAMO, SAT, etc.)
  - Year
  - Test variant (A, B, etc.)
  - Problem number
  - Subject (Math, Physics, etc.)
  - Topic (Algebra, Geometry, Calculus, etc.)
  - Difficulty level (1-10)
  - Solution text
  - Answer key
  - Source URL
- [ ] Create full-text search indexes on problem text and solution
- [ ] Build bulk import functionality for problem datasets
- [ ] Implement problem versioning and edit history
- [ ] Add tenant-scoped problem isolation

### Technical Stack
- PostgreSQL with full-text search (tsvector, tsquery)
- REST API endpoints (`/api/v1/problems`)
- TypeScript types for problem metadata

### Acceptance Criteria
- Store and retrieve problems with all metadata fields
- Perform full-text search with <200ms response time
- Support bulk import of 1000+ problems
- Maintain data isolation per tenant

---

## Phase 3: Problem Matching & Identification

**Feature Reference**: docs/feature.md:4

**Objective**: Identify problems from photos by matching against existing repository.

### Tasks
- [ ] Generate text embeddings for all repository problems
- [ ] Implement similarity matching algorithm (cosine similarity on embeddings)
- [ ] Build problem identification service using OpenAI GPT-4 for semantic matching
- [ ] Create confidence scoring system (0-100%)
- [ ] Handle partial matches and provide ranked suggestions
- [ ] Implement fuzzy text matching as fallback when AI unavailable
- [ ] Add caching layer for frequently matched problems
- [ ] Build API endpoint for problem identification

### Technical Stack
- OpenAI Embeddings API (text-embedding-3-small)
- Vector similarity calculation (cosine distance)
- Redis for embedding cache
- PostgreSQL pgvector extension (optional)

### Acceptance Criteria
- Correctly identify exact matches with >95% confidence
- Provide top 5 ranked suggestions for partial matches
- Handle slight variations in problem wording
- Return results in <2 seconds

---

## Phase 4: Multi-Subject Extensibility

**Feature Reference**: docs/feature.md:5

**Objective**: Design flexible system to support subjects beyond Math.

### Tasks
- [ ] Design hierarchical subject taxonomy (Subject → Topic → Subtopic)
- [ ] Create subject-specific metadata schemas using JSON
- [ ] Build tagging and categorization system
- [ ] Implement subject templates:
  - Mathematics (Algebra, Geometry, Calculus, Statistics, etc.)
  - Physics (Mechanics, Thermodynamics, Electromagnetism, etc.)
  - Chemistry (Organic, Inorganic, Physical, etc.)
  - Biology (Molecular, Ecology, Genetics, etc.)
  - Computer Science (Algorithms, Data Structures, etc.)
- [ ] Add subject-specific validators and parsers
- [ ] Build admin interface for subject management
- [ ] Implement subject-based search and filtering

### Technical Stack
- JSONB fields in PostgreSQL for flexible metadata
- JSON Schema validation
- Hierarchical data structures

### Acceptance Criteria
- Support at least 5 different subjects at launch
- Allow dynamic addition of new subjects without schema changes
- Maintain consistent API interface across all subjects
- Enable cross-subject search and study

---

## Phase 5: Multi-Platform Backend (SaaS)

**Feature Reference**: docs/feature.md:9, docs/feature.md:10

**Objective**: Build scalable REST API backend supporting iOS, Android, and Web clients.

### Tasks
- [ ] Design RESTful API architecture with versioning (`/api/v1`)
- [ ] Implement comprehensive API endpoints:
  - Auth: `/auth/register`, `/auth/login`, `/auth/oauth`
  - Problems: `/problems`, `/problems/:id`, `/problems/search`
  - OCR: `/ocr/upload`, `/ocr/identify`
  - Study: `/study/cards`, `/study/review`, `/study/sets`
  - Gamification: `/gamification/score`, `/gamification/achievements`
  - Payment: `/payment/subscribe`, `/payment/portal`
- [ ] Set up API documentation using OpenAPI/Swagger
- [ ] Implement rate limiting per user/tenant
- [ ] Configure CORS for cross-origin requests
- [ ] Add Redis caching layer for expensive operations
- [ ] Build comprehensive error handling and logging
- [ ] Implement health check and monitoring endpoints
- [ ] Set up containerization with Docker
- [ ] Design database migration strategy

### Technical Stack
- Node.js with Express/Fastify
- TypeScript for type safety
- PostgreSQL for primary data storage
- Redis for caching and sessions
- Docker for containerization
- OpenAPI/Swagger for documentation

### Acceptance Criteria
- API handles 1000+ concurrent requests
- Response time <500ms for 95% of requests
- Comprehensive API documentation
- Zero downtime deployments
- Multi-tenant data isolation enforced

---

## Phase 6: Authentication System

**Feature Reference**: docs/feature.md:8

**Objective**: Implement secure authentication with OAuth and multi-tenancy support.

### Tasks
- [ ] Set up JWT-based authentication with refresh tokens
- [ ] Implement email/password registration with email verification
- [ ] Integrate Google OAuth 2.0 (Sign in with Google)
- [ ] Integrate Sign in with Apple
- [ ] Build password reset flow with secure tokens
- [ ] Implement multi-tenancy with tenant isolation
- [ ] Create user profile management endpoints
- [ ] Add role-based access control (RBAC)
- [ ] Implement session management and logout
- [ ] Build account deletion and data export
- [ ] Add two-factor authentication (2FA) support

### Technical Stack
- Passport.js for authentication strategies
- OAuth 2.0 for Google and Apple
- JWT with RS256 signing
- bcrypt for password hashing
- Redis for session storage

### Acceptance Criteria
- Secure OAuth flows for Google and Apple
- Email verification with expiring tokens
- Session management with automatic refresh
- Multi-tenant data isolation at query level
- GDPR-compliant data export and deletion

---

## Phase 7: Payment Integration

**Feature Reference**: docs/feature.md:8

**Objective**: Integrate Stripe for subscription management and payments.

### Tasks
- [ ] Integrate Stripe SDK for Node.js
- [ ] Design subscription tiers:
  - Free: 10 problems/month, basic features
  - Premium: Unlimited problems, advanced features, $9.99/month
  - Enterprise: Multi-tenant, API access, custom pricing
- [ ] Implement Stripe Checkout for subscription signup
- [ ] Build webhook handlers for payment events:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- [ ] Create billing portal integration for subscription management
- [ ] Add usage tracking and quota enforcement
- [ ] Implement subscription status checks in API middleware
- [ ] Build invoice history and receipt management
- [ ] Add payment method management

### Technical Stack
- Stripe SDK
- Stripe Checkout
- Stripe Customer Portal
- Webhook signature verification
- PostgreSQL for subscription tracking

### Acceptance Criteria
- Secure payment processing with PCI compliance
- Automatic subscription status updates via webhooks
- Quota enforcement based on subscription tier
- User-friendly billing portal
- Proper handling of failed payments and dunning

---

## Phase 8: Spaced Repetition System

**Feature Reference**: docs/feature.md:11, docs/feature.md:12

**Objective**: Implement spaced repetition based on the forgetting curve for optimal learning.

### Tasks
- [ ] Implement SM-2 algorithm (SuperMemo 2) for card scheduling
- [ ] Build forgetting curve calculation engine
- [ ] Create review scheduling system with due dates
- [ ] Implement difficulty adjustment based on user performance:
  - Easy: Interval × 2.5
  - Good: Interval × 2.0
  - Hard: Interval × 1.2
  - Again: Reset to 1 day
- [ ] Add daily review queue generation
- [ ] Build review history tracking
- [ ] Implement interval cap and graduation thresholds
- [ ] Create API endpoints for review management
- [ ] Add statistics and progress analytics
- [ ] Build notification system for due reviews

### Technical Stack
- SM-2 algorithm implementation
- PostgreSQL for card scheduling data
- Cron jobs for daily queue generation
- Push notifications for review reminders

### Acceptance Criteria
- Cards scheduled according to forgetting curve
- Review intervals adapt based on performance
- Daily review queue auto-generated
- Progress tracking over time
- <100ms calculation time per card update

---

## Phase 9: Custom Study Sets

**Feature Reference**: docs/feature.md:12

**Objective**: Allow users to create and study custom problem sets with spaced repetition.

### Tasks
- [ ] Design study set data model
- [ ] Build API endpoints for study set management:
  - Create set
  - Add/remove problems
  - Update set metadata
  - Delete set
  - Share set with other users
- [ ] Implement study set templates (exam prep, topic focus, etc.)
- [ ] Apply spaced repetition scheduling to custom sets
- [ ] Build progress tracking per study set
- [ ] Add study session management (start, pause, complete)
- [ ] Implement set statistics and analytics
- [ ] Create public/private set visibility options
- [ ] Build set discovery and search

### Technical Stack
- PostgreSQL for set storage and relations
- Many-to-many relationship between sets and problems
- Spaced repetition integration

### Acceptance Criteria
- Users can create unlimited study sets
- Sets can contain problems from repository
- Spaced repetition applies to each set independently
- Progress tracked separately per set
- Sets can be shared with other users

---

## Phase 10: Gamification & Rewards

**Feature Reference**: docs/feature.md:13

**Objective**: Build engaging scoring system with achievements and leaderboards.

### Tasks
- [ ] Design points system:
  - Problem completion: 10-100 points based on difficulty
  - Daily streak bonus: +50 points
  - Perfect review: +20 points
  - Speed bonus: +10 points for quick correct answers
- [ ] Implement leveling system (XP-based progression)
- [ ] Build achievement system with badges:
  - First problem solved
  - 7-day streak
  - 100 problems solved
  - Perfect week
  - Speed demon (fast answers)
- [ ] Create streak tracking (daily, weekly)
- [ ] Build leaderboards:
  - Global leaderboard
  - Friends leaderboard
  - Tenant-based leaderboard
- [ ] Add daily challenges and quests
- [ ] Implement reward notifications
- [ ] Build achievement showcase on profile
- [ ] Add social features (follow, compare progress)

### Technical Stack
- PostgreSQL for scores and achievements
- Redis for leaderboard caching
- Real-time updates via WebSockets
- Push notifications for achievements

### Acceptance Criteria
- Points awarded immediately after actions
- Achievements unlock automatically
- Leaderboards update in real-time
- Streak tracking persists across sessions
- Daily challenges refresh at midnight UTC

---

## Phase 11: iOS Mobile App

**Feature Reference**: docs/feature.md:7, docs/feature.md:14

**Objective**: Build native iOS app with camera integration and deploy to App Store.

### Tasks
- [ ] Set up iOS project in Xcode with Swift
- [ ] Design app architecture (MVVM or Clean Architecture)
- [ ] Implement authentication screens:
  - Login, Register, OAuth flows
- [ ] Build camera interface for problem capture
- [ ] Integrate image upload and OCR API
- [ ] Build problem identification results screen
- [ ] Create study interface with flashcard UI
- [ ] Implement spaced repetition scheduling UI
- [ ] Build study set management screens
- [ ] Add gamification dashboard (points, level, achievements)
- [ ] Implement push notifications for review reminders
- [ ] Build user profile and settings
- [ ] Add offline mode with local data sync
- [ ] Implement analytics tracking
- [ ] Set up App Store deployment:
  - App Store Connect setup
  - Screenshots and app preview
  - TestFlight beta testing
  - App Store submission

### Technical Stack
- Swift 5.9+
- SwiftUI for UI
- Combine for reactive programming
- URLSession for networking
- Core Data for local storage
- Apple Push Notification Service (APNs)
- Xcode Cloud for CI/CD

### Acceptance Criteria
- Native iOS experience with smooth animations
- Camera captures and uploads images quickly
- Offline mode syncs when network available
- Push notifications delivered reliably
- App approved and live on App Store

---

## Phase 12: Android Mobile App

**Feature Reference**: docs/feature.md:7, docs/feature.md:14

**Objective**: Build native Android app with camera integration and deploy to Google Play.

### Tasks
- [ ] Set up Android project in Android Studio with Kotlin
- [ ] Design app architecture (MVVM with Clean Architecture)
- [ ] Implement authentication screens:
  - Login, Register, OAuth flows
- [ ] Build camera interface using CameraX
- [ ] Integrate image upload and OCR API
- [ ] Build problem identification results screen
- [ ] Create study interface with flashcard UI
- [ ] Implement spaced repetition scheduling UI
- [ ] Build study set management screens
- [ ] Add gamification dashboard (points, level, achievements)
- [ ] Implement push notifications using Firebase Cloud Messaging
- [ ] Build user profile and settings
- [ ] Add offline mode with local data sync (Room database)
- [ ] Implement analytics tracking (Firebase Analytics)
- [ ] Set up Google Play deployment:
  - Google Play Console setup
  - Store listing and assets
  - Internal/closed testing
  - Production release

### Technical Stack
- Kotlin 1.9+
- Jetpack Compose for UI
- Kotlin Coroutines and Flow
- Retrofit for networking
- Room for local database
- Firebase Cloud Messaging (FCM)
- CameraX for camera
- Android Studio

### Acceptance Criteria
- Native Android experience with Material Design 3
- Camera captures and uploads images efficiently
- Offline mode syncs when online
- Push notifications delivered reliably
- App approved and live on Google Play Store

---

## Phase 13: Web Application

**Feature Reference**: docs/feature.md:7

**Objective**: Build responsive web application with PWA capabilities.

### Tasks
- [ ] Set up Next.js project with TypeScript
- [ ] Design responsive UI with Tailwind CSS
- [ ] Implement authentication:
  - Login, Register, OAuth integration
- [ ] Build file upload interface for problem images
- [ ] Integrate OCR API with progress indicators
- [ ] Build problem identification results page
- [ ] Create study interface with keyboard shortcuts
- [ ] Implement spaced repetition review flow
- [ ] Build study set management UI
- [ ] Add gamification dashboard with charts
- [ ] Build user profile and settings
- [ ] Implement real-time updates with WebSockets
- [ ] Add Progressive Web App (PWA) features:
  - Service worker for offline support
  - App manifest for install prompt
  - Push notifications
- [ ] Build admin dashboard for problem management
- [ ] Implement analytics dashboard
- [ ] Set up web hosting and CDN
- [ ] Configure SSL certificates
- [ ] Add SEO optimization

### Technical Stack
- Next.js 14+ (React framework)
- TypeScript
- Tailwind CSS for styling
- React Query for data fetching
- WebSockets for real-time updates
- PWA with service workers
- Vercel/AWS for hosting

### Acceptance Criteria
- Responsive design works on mobile, tablet, desktop
- PWA installable on supported browsers
- Keyboard shortcuts for power users
- Real-time updates without page refresh
- <2s initial page load time
- SEO-optimized for search engines

---

## Implementation Priority

Based on the existing codebase (per CLAUDE.md), **Phases 1-10 are already partially implemented**. The priority order for completion is:

### ✅ Already Implemented (Verify and Refine)
1. **Phase 1**: OCR Service (ocrService.ts exists)
2. **Phase 2**: Problem Repository (problemRepository.ts exists)
3. **Phase 3**: Problem Matcher (problemMatcher.ts exists)
4. **Phase 5**: Multi-Platform Backend (API structure exists)
5. **Phase 6**: Authentication System (authService.ts exists)
6. **Phase 7**: Payment Integration (paymentService.ts exists)
7. **Phase 8**: Spaced Repetition (spacedRepetition.ts exists)
8. **Phase 10**: Gamification (gamificationService.ts exists)

### 🔄 Partially Implemented (Complete Missing Features)
9. **Phase 4**: Multi-Subject Extensibility (needs schema design)
10. **Phase 9**: Custom Study Sets (needs full implementation)

### 🆕 Not Yet Started (Build from Scratch)
11. **Phase 11**: iOS Mobile App
12. **Phase 12**: Android Mobile App
13. **Phase 13**: Web Application

---

## Success Metrics

### Technical Metrics
- API response time: <500ms (p95)
- OCR accuracy: >90% on clear images
- Problem matching accuracy: >95% for exact matches
- Uptime: 99.9%
- Mobile app crash rate: <1%

### User Engagement Metrics
- Daily active users (DAU)
- Study session completion rate: >80%
- Review adherence rate: >70%
- Retention (D1, D7, D30)
- Conversion rate (free → paid): >5%

### Business Metrics
- Monthly recurring revenue (MRR)
- Customer acquisition cost (CAC)
- Lifetime value (LTV)
- Churn rate: <5% monthly

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1 | 2 weeks | None |
| Phase 2 | 2 weeks | None |
| Phase 3 | 2 weeks | Phase 1, 2 |
| Phase 4 | 1 week | Phase 2 |
| Phase 5 | 3 weeks | Phase 1-4 |
| Phase 6 | 2 weeks | Phase 5 |
| Phase 7 | 2 weeks | Phase 6 |
| Phase 8 | 2 weeks | Phase 2, 5 |
| Phase 9 | 2 weeks | Phase 8 |
| Phase 10 | 2 weeks | Phase 5 |
| Phase 11 | 8 weeks | Phase 5-10 |
| Phase 12 | 8 weeks | Phase 5-10 |
| Phase 13 | 6 weeks | Phase 5-10 |

**Total estimated timeline**: 6-9 months with a team of 3-5 developers working in parallel.

---

## Risk Assessment

### High Risk
- **OCR Accuracy**: Surya OCR may not work well with handwritten problems
  - *Mitigation*: Add fallback OCR services, allow manual correction
- **Mobile App Approval**: App Store/Play Store rejections
  - *Mitigation*: Thorough review of guidelines, legal review of features
- **Stripe Integration**: Payment processing compliance
  - *Mitigation*: Use Stripe's recommended integration patterns, legal review

### Medium Risk
- **AI Costs**: OpenAI API costs may be high at scale
  - *Mitigation*: Implement caching, rate limiting, consider self-hosted models
- **Scalability**: Backend may struggle with high load
  - *Mitigation*: Load testing, horizontal scaling, CDN for static assets

### Low Risk
- **Feature Complexity**: Spaced repetition algorithm complexity
  - *Mitigation*: Use proven SM-2 algorithm, extensive testing

---

## Next Steps

1. **Review and validate** this implementation plan with stakeholders
2. **Set up project tracking** (Jira, Linear, GitHub Projects)
3. **Complete Phases 4 and 9** (missing backend features)
4. **Prioritize client development** (start with Web, then iOS, then Android)
5. **Set up CI/CD pipelines** for each platform
6. **Plan user testing and beta programs**
7. **Prepare marketing and launch strategy**
