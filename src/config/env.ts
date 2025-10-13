import dotenv from 'dotenv';

dotenv.config();

interface EnvironmentConfig {
  // Database
  DATABASE_URL: string;
  REDIS_URL: string;

  // JWT
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;

  // Session
  SESSION_SECRET: string;

  // Stripe
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;

  // OpenAI
  OPENAI_API_KEY: string;

  // OCR Service
  OCR_SERVICE_URL: string;

  // Server
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';

  // File Upload
  MAX_FILE_SIZE: number;
  UPLOAD_DIR: string;

  // OAuth - Google
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;

  // OAuth - Apple
  APPLE_CLIENT_ID?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;

  // Email (SMTP)
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM: string;

  // Frontend URL
  FRONTEND_URL: string;
  API_URL: string;
}

/**
 * Validates that all required environment variables are present
 * Throws an error if any required variable is missing
 */
function validateEnvironment(): EnvironmentConfig {
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'SESSION_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'OPENAI_API_KEY',
    'OCR_SERVICE_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'FRONTEND_URL',
    'API_URL',
  ];

  const missingVars: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missingVars.map(v => `  - ${v}`).join('\n')}\n\n` +
      `Please check your .env file and ensure all required variables are set.\n` +
      `See .env.example for reference.`
    );
  }

  // Validate JWT secrets are strong enough
  const jwtSecret = process.env.JWT_SECRET!;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET!;

  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security');
  }

  if (jwtRefreshSecret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long for security');
  }

  // Validate NODE_ENV
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error(`Invalid NODE_ENV: ${nodeEnv}. Must be 'development', 'production', or 'test'`);
  }

  // Parse and validate numeric values
  const port = parseInt(process.env.PORT || '3000', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}. Must be a valid port number (1-65535)`);
  }

  const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10);
  if (isNaN(maxFileSize) || maxFileSize < 1) {
    throw new Error(`Invalid MAX_FILE_SIZE: ${process.env.MAX_FILE_SIZE}. Must be a positive number`);
  }

  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  if (isNaN(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error(`Invalid SMTP_PORT: ${process.env.SMTP_PORT}. Must be a valid port number (1-65535)`);
  }

  const smtpSecure = process.env.SMTP_SECURE === 'true';

  // Validate URLs
  try {
    new URL(process.env.FRONTEND_URL!);
    new URL(process.env.API_URL!);
    new URL(process.env.OCR_SERVICE_URL!);
  } catch (error) {
    throw new Error(`Invalid URL format in FRONTEND_URL, API_URL, or OCR_SERVICE_URL: ${error}`);
  }

  // Validate Stripe keys format
  if (!process.env.STRIPE_SECRET_KEY!.startsWith('sk_')) {
    throw new Error('Invalid STRIPE_SECRET_KEY format. Must start with "sk_"');
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET!.startsWith('whsec_')) {
    throw new Error('Invalid STRIPE_WEBHOOK_SECRET format. Must start with "whsec_"');
  }

  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    JWT_SECRET: jwtSecret,
    JWT_REFRESH_SECRET: jwtRefreshSecret,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    SESSION_SECRET: process.env.SESSION_SECRET!,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY!,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET!,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
    OCR_SERVICE_URL: process.env.OCR_SERVICE_URL!,
    PORT: port,
    NODE_ENV: nodeEnv as 'development' | 'production' | 'test',
    MAX_FILE_SIZE: maxFileSize,
    UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
    APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID,
    APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
    APPLE_KEY_ID: process.env.APPLE_KEY_ID,
    APPLE_PRIVATE_KEY: process.env.APPLE_PRIVATE_KEY,
    SMTP_HOST: process.env.SMTP_HOST!,
    SMTP_PORT: smtpPort,
    SMTP_SECURE: smtpSecure,
    SMTP_USER: process.env.SMTP_USER!,
    SMTP_PASS: process.env.SMTP_PASS!,
    SMTP_FROM: process.env.SMTP_FROM || 'noreply@sbuddy.com',
    FRONTEND_URL: process.env.FRONTEND_URL!,
    API_URL: process.env.API_URL!,
  };
}

// Validate environment on module load
let config: EnvironmentConfig;

try {
  config = validateEnvironment();
  console.log('✅ Environment variables validated successfully');
} catch (error) {
  console.error('❌ Environment validation failed:');
  console.error((error as Error).message);
  process.exit(1);
}

export default config;
