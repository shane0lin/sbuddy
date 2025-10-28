import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config from './config/env'; // Validates environment on import
import passport from './config/passport';
import session from 'express-session';
import { initializeDatabase } from './models/database';
import { createGamificationTables } from './services/gamificationService';
import routes from './routes';
import authRoutes from './routes/auth';
import crawledProblemsRoutes from './routes/crawledProblemsRoutes';

const app = express();
const PORT = config.PORT;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.FRONTEND_URL,
  credentials: true
}));

// Request logging
app.use(morgan('combined'));

// Body parsing middleware
app.use('/webhooks/stripe', express.raw({ type: 'application/json' })); // Raw body for Stripe webhooks
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session middleware for OAuth (required by Passport)
app.use(session({
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// API routes
app.use('/api/v1/auth', authRoutes); // New enhanced auth routes
app.use('/api/v1/crawled', crawledProblemsRoutes); // Crawled problems (public read-only)
app.use('/api/v1', routes); // Existing routes

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);

  if (err.message.includes('Invalid file type')) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err.message.includes('File too large')) {
    res.status(413).json({ error: 'File size too large' });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    await createGamificationTables();

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Sbuddy Backend Server running on port ${PORT}`);
      console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api/v1`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

startServer();