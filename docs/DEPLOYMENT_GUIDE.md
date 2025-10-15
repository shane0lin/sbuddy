# Sbuddy Deployment Guide

Complete guide for deploying Sbuddy backend to production environments.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Docker Deployment](#docker-deployment)
4. [Cloud Deployments](#cloud-deployments)
5. [Database Setup](#database-setup)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Monitoring & Logging](#monitoring--logging)
8. [Security Checklist](#security-checklist)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- Docker 20.10+ and Docker Compose 2.0+
- Node.js 18+ (for local development)
- PostgreSQL 15+
- Redis 7+

### Required Services
- **Stripe Account** - For payment processing
- **OpenAI API Key** - For AI-powered features
- **OCR Service** - Surya OCR or compatible service
- **Email Service** - SMTP server (Gmail, SendGrid, etc.)
- **OAuth Providers** - Google and/or Apple developer accounts

---

## Environment Setup

### 1. Copy Environment Template

```bash
cp .env.example .env
```

### 2. Generate Secure Secrets

```bash
# Generate JWT secrets (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Do this 3 times for:
# - JWT_SECRET
# - JWT_REFRESH_SECRET
# - SESSION_SECRET
```

### 3. Configure Environment Variables

Edit `.env` file:

```bash
# Database
DATABASE_URL=postgresql://sbuddy:STRONG_PASSWORD@localhost:5432/sbuddy_db
REDIS_URL=redis://:REDIS_PASSWORD@localhost:6379

# JWT (use generated secrets)
JWT_SECRET=your-64-character-hex-string-here
JWT_REFRESH_SECRET=your-64-character-hex-string-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Session
SESSION_SECRET=your-64-character-hex-string-here

# Stripe
STRIPE_SECRET_KEY=sk_live_...  # Use sk_test_... for testing
STRIPE_WEBHOOK_SECRET=whsec_...

# OpenAI
OPENAI_API_KEY=sk-...

# OCR Service
OCR_SERVICE_URL=http://localhost:8000

# Server
PORT=3000
NODE_ENV=production

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_DIR=uploads

# OAuth - Google
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# OAuth - Apple (optional)
APPLE_CLIENT_ID=com.yourcompany.sbuddy
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@sbuddy.com

# URLs
FRONTEND_URL=https://sbuddy.com
API_URL=https://api.sbuddy.com
```

---

## Docker Deployment

### Quick Start

```bash
# Build and start all services
docker-compose up -d

# Check logs
docker-compose logs -f api

# Run migrations
docker-compose exec api npm run migrate

# Stop services
docker-compose down
```

### Production Build

```bash
# Build optimized image
docker build -t sbuddy-api:latest .

# Run with specific env file
docker-compose --env-file .env.production up -d

# Scale API instances
docker-compose up -d --scale api=3
```

### Docker Commands

```bash
# View running containers
docker-compose ps

# Restart API service
docker-compose restart api

# View API logs
docker-compose logs -f --tail=100 api

# Execute command in container
docker-compose exec api npm run migrate

# Clean up
docker-compose down -v  # Remove volumes too
```

---

## Cloud Deployments

### AWS (Elastic Beanstalk)

1. **Install EB CLI**:
```bash
pip install awsebcli
```

2. **Initialize EB Application**:
```bash
eb init -p docker sbuddy-api
```

3. **Create Environment**:
```bash
eb create sbuddy-production \
  --database \
  --database.engine postgres \
  --database.size 10 \
  --instance-type t3.medium \
  --envvars $(cat .env | xargs)
```

4. **Deploy**:
```bash
eb deploy
```

5. **Configure RDS & ElastiCache**:
- Update `DATABASE_URL` with RDS endpoint
- Update `REDIS_URL` with ElastiCache endpoint

### Google Cloud Platform (Cloud Run)

1. **Build and Push Image**:
```bash
# Configure gcloud
gcloud auth configure-docker

# Build image
docker build -t gcr.io/YOUR_PROJECT/sbuddy-api:latest .

# Push to GCR
docker push gcr.io/YOUR_PROJECT/sbuddy-api:latest
```

2. **Deploy to Cloud Run**:
```bash
gcloud run deploy sbuddy-api \
  --image gcr.io/YOUR_PROJECT/sbuddy-api:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "$(cat .env | xargs | tr ' ' ',')"
```

3. **Set up Cloud SQL & Memorystore**:
```bash
# Create PostgreSQL instance
gcloud sql instances create sbuddy-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create Redis instance
gcloud redis instances create sbuddy-cache \
  --size=1 \
  --region=us-central1
```

### Azure (Container Instances)

1. **Create Resource Group**:
```bash
az group create --name sbuddy-rg --location eastus
```

2. **Create Container Registry**:
```bash
az acr create --resource-group sbuddy-rg \
  --name sbuddyregistry --sku Basic
```

3. **Build and Push**:
```bash
az acr build --registry sbuddyregistry \
  --image sbuddy-api:latest .
```

4. **Deploy Container**:
```bash
az container create \
  --resource-group sbuddy-rg \
  --name sbuddy-api \
  --image sbuddyregistry.azurecr.io/sbuddy-api:latest \
  --dns-name-label sbuddy-api \
  --ports 3000 \
  --environment-variables $(cat .env | xargs)
```

### Heroku

1. **Login to Heroku**:
```bash
heroku login
heroku container:login
```

2. **Create App**:
```bash
heroku create sbuddy-api
```

3. **Add Add-ons**:
```bash
# PostgreSQL
heroku addons:create heroku-postgresql:standard-0

# Redis
heroku addons:create heroku-redis:premium-0
```

4. **Set Environment Variables**:
```bash
heroku config:set JWT_SECRET=your-secret
heroku config:set STRIPE_SECRET_KEY=sk_live_...
# ... set all variables
```

5. **Deploy**:
```bash
heroku container:push web
heroku container:release web

# Run migrations
heroku run npm run migrate
```

### DigitalOcean (App Platform)

1. **Create app.yaml**:
```yaml
name: sbuddy-api
services:
  - name: api
    github:
      repo: your-username/sbuddy
      branch: main
      deploy_on_push: true
    dockerfile_path: Dockerfile
    http_port: 3000
    instance_count: 2
    instance_size_slug: professional-xs
    routes:
      - path: /
    envs:
      - key: NODE_ENV
        value: "production"
      - key: JWT_SECRET
        value: "${JWT_SECRET}"
      # ... all env vars

databases:
  - name: sbuddy-db
    engine: PG
    version: "15"
  - name: sbuddy-redis
    engine: REDIS
    version: "7"
```

2. **Deploy**:
```bash
doctl apps create --spec app.yaml
```

---

## Database Setup

### Manual Migration

```bash
# Run all pending migrations
npm run migrate

# Or with Docker
docker-compose exec api npm run migrate
```

### Backup Database

```bash
# Local backup
pg_dump -U sbuddy sbuddy_db > backup_$(date +%Y%m%d).sql

# Docker backup
docker-compose exec postgres pg_dump -U sbuddy sbuddy_db > backup.sql
```

### Restore Database

```bash
# Local restore
psql -U sbuddy sbuddy_db < backup.sql

# Docker restore
cat backup.sql | docker-compose exec -T postgres psql -U sbuddy sbuddy_db
```

### Database Scaling

**Read Replicas**:
```sql
-- Create read replica (PostgreSQL)
CREATE PUBLICATION sbuddy_pub FOR ALL TABLES;

-- On replica
CREATE SUBSCRIPTION sbuddy_sub
  CONNECTION 'host=primary-db port=5432 dbname=sbuddy_db'
  PUBLICATION sbuddy_pub;
```

---

## CI/CD Pipeline

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: docker/setup-buildx-action@v2
      - uses: docker/login-action@v2
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v4
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/sbuddy
            docker-compose pull
            docker-compose up -d
            docker-compose exec api npm run migrate
```

### GitLab CI

Create `.gitlab-ci.yml`:

```yaml
stages:
  - test
  - build
  - deploy

test:
  stage: test
  image: node:18-alpine
  script:
    - npm ci
    - npm run typecheck
    - npm run lint
    - npm test

build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

deploy_production:
  stage: deploy
  only:
    - main
  script:
    - ssh user@server "cd /opt/sbuddy && docker-compose pull && docker-compose up -d"
```

---

## Monitoring & Logging

### Health Checks

```bash
# API health check
curl https://api.sbuddy.com/api/v1/health

# OCR health check
curl https://api.sbuddy.com/api/v1/ocr/health
```

### Logging with Winston

Already configured in the app. View logs:

```bash
# Docker logs
docker-compose logs -f api

# Application logs
tail -f logs/app.log
tail -f logs/error.log
```

### Application Performance Monitoring

**New Relic**:
```bash
npm install newrelic
```

Add to `src/index.ts`:
```typescript
require('newrelic');
```

**Datadog**:
```bash
npm install dd-trace
```

**Sentry** (Error Tracking):
```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});
```

---

## Security Checklist

### Pre-Deployment

- [ ] All environment variables set securely
- [ ] JWT secrets are 32+ characters
- [ ] Database uses strong passwords
- [ ] HTTPS/TLS enabled
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] File upload limits set
- [ ] SQL injection prevention (parameterized queries) ✅
- [ ] XSS protection (Helmet) ✅
- [ ] CSRF protection
- [ ] Input validation (Joi) ✅
- [ ] Dependencies updated (`npm audit`)

### Post-Deployment

- [ ] Change default passwords
- [ ] Enable database backups
- [ ] Set up monitoring alerts
- [ ] Configure firewall rules
- [ ] Enable database encryption at rest
- [ ] Set up WAF (Web Application Firewall)
- [ ] Regular security updates
- [ ] Penetration testing

### SSL/TLS Setup

**Let's Encrypt with Certbot**:
```bash
# Install certbot
sudo apt-get install certbot

# Get certificate
sudo certbot certonly --standalone -d api.sbuddy.com

# Auto-renewal
sudo crontab -e
# Add: 0 0 * * * certbot renew
```

**Nginx Reverse Proxy**:
```nginx
server {
    listen 443 ssl http2;
    server_name api.sbuddy.com;

    ssl_certificate /etc/letsencrypt/live/api.sbuddy.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.sbuddy.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs api

# Common issues:
# 1. Port already in use
sudo lsof -i :3000

# 2. Environment variables missing
docker-compose config

# 3. Build cache issues
docker-compose build --no-cache
```

### Database Connection Failed

```bash
# Test database connection
docker-compose exec postgres psql -U sbuddy -d sbuddy_db

# Check network
docker network ls
docker network inspect sbuddy-network

# Verify connection string
echo $DATABASE_URL
```

### Migrations Failed

```bash
# Check migration status
docker-compose exec api psql $DATABASE_URL -c "SELECT * FROM migrations;"

# Roll back manually
# Edit migrations table or drop schema

# Re-run migrations
docker-compose exec api npm run migrate
```

### High Memory Usage

```bash
# Check memory usage
docker stats

# Limit container memory
docker-compose.yml:
  api:
    deploy:
      resources:
        limits:
          memory: 512M
```

### API Not Responding

```bash
# Check if container is running
docker-compose ps

# Check health
curl http://localhost:3000/api/v1/health

# Restart service
docker-compose restart api
```

---

## Performance Optimization

### Database Optimization

```sql
-- Create indexes
CREATE INDEX CONCURRENTLY idx_problems_search ON problems USING GIN(search_vector);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM problems WHERE ...;

-- Vacuum database
VACUUM ANALYZE;
```

### Redis Caching

```typescript
// Example caching pattern
async function getProblems(category: string) {
  const cacheKey = `problems:${category}`;

  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Fetch from DB
  const problems = await db.query(...);

  // Cache for 1 hour
  await redis.setex(cacheKey, 3600, JSON.stringify(problems));

  return problems;
}
```

### Load Balancing

```nginx
upstream sbuddy_api {
    least_conn;
    server api1:3000;
    server api2:3000;
    server api3:3000;
}

server {
    location / {
        proxy_pass http://sbuddy_api;
    }
}
```

---

## Maintenance

### Regular Tasks

**Daily**:
- Check error logs
- Monitor API response times
- Verify backups completed

**Weekly**:
- Review security alerts
- Update dependencies
- Check disk space

**Monthly**:
- Database optimization (VACUUM, ANALYZE)
- Review and rotate logs
- Security audit
- Performance testing

### Backup Strategy

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
docker-compose exec postgres pg_dump -U sbuddy sbuddy_db | \
  gzip > backups/db_$DATE.sql.gz

# Upload to S3
aws s3 cp backups/db_$DATE.sql.gz s3://sbuddy-backups/

# Keep only last 30 days
find backups/ -name "db_*.sql.gz" -mtime +30 -delete
```

---

## Support & Resources

- **Documentation**: https://docs.sbuddy.com
- **API Reference**: See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **Status Page**: https://status.sbuddy.com
- **Support**: support@sbuddy.com

---

## Quick Reference

### Essential Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f api

# Run migrations
docker-compose exec api npm run migrate

# Backup database
docker-compose exec postgres pg_dump -U sbuddy sbuddy_db > backup.sql

# Scale API
docker-compose up -d --scale api=3

# Update and redeploy
git pull
docker-compose build
docker-compose up -d
```

### Environment Variables Quick Check

```bash
# Verify all required variables are set
node -e "require('./dist/config/env.js')"

# This will fail fast if any required variable is missing
```
