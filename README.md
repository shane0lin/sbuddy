# Sbuddy Backend

AI-Powered Problem Recognition & Study System

## Features

🔍 **OCR Processing** - Convert photos to text using Surya OCR
🧠 **AI Problem Matching** - Identify problems using GPT-4
📚 **Problem Repository** - Organized database of problems by exam/subject
🔄 **Spaced Repetition** - Optimal review scheduling with SM-2 algorithm
🎮 **Gamification** - Points, levels, streaks, and achievements
💳 **Stripe Integration** - Subscription management
🏢 **Multi-tenancy** - Organization-level data isolation

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Test the API**
   ```bash
   curl http://localhost:3000/api/v1/health
   ```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/profile` - Get user profile

### OCR & Problem Recognition
- `POST /api/v1/ocr/process` - Upload image for OCR processing
- `POST /api/v1/ocr/process-buffer` - Process base64 image data

### Problems
- `GET /api/v1/problems/search` - Search problems
- `POST /api/v1/problems` - Create new problem
- `POST /api/v1/problems/:id/answer` - Submit problem answer

### Study System
- `GET /api/v1/study/due-cards` - Get problems due for review
- `GET /api/v1/study/statistics` - User study statistics

### Gamification
- `GET /api/v1/gamification/score` - User score and level
- `GET /api/v1/gamification/leaderboard` - Top users leaderboard

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Mobile Apps   │    │    Web Client    │    │  Admin Panel    │
│  (iOS/Android)  │    │   (React/Vue)    │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    API Gateway/LB       │
                    │   (Express.js/Node)     │
                    └────────────┬────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                       │                        │
┌───────▼────────┐    ┌────────▼────────┐    ┌─────────▼────────┐
│  OCR Service   │    │ Problem Matcher │    │ Spaced Repetition│
│   (Surya)      │    │   (OpenAI)      │    │   (SM-2 Algo)    │
└────────────────┘    └─────────────────┘    └──────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │     Database Layer      │
                    │  PostgreSQL + Redis     │
                    └─────────────────────────┘
```

## Tech Stack

- **Backend**: Node.js + TypeScript + Express
- **Database**: PostgreSQL + Redis
- **OCR**: Surya OCR Service
- **AI**: OpenAI GPT-4
- **Payments**: Stripe
- **Auth**: JWT tokens

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Database Setup

The application automatically creates database tables on startup. Ensure PostgreSQL and Redis are running and accessible via the connection strings in your `.env` file.

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/sbuddy_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
OPENAI_API_KEY=your-openai-api-key
OCR_SERVICE_URL=http://localhost:8000
```

## AMC 10 Problem Scraping

Sbuddy includes a powerful web scraper for AMC 10 problems from Art of Problem Solving:

```bash
# Quick demo (no database required)
npm run scrape-amc:demo

# Import problems to database
npm run scrape-amc -- --year 2024 --test A --count 10
```

See [AMC Scraping Guide](docs/AMC_SCRAPING_GUIDE.md) for complete documentation.

## License

MIT