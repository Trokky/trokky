---
title: Deployment
description: Deploy Trokky to production environments
---

This guide covers deploying Trokky to various hosting platforms and production best practices.

## Pre-Deployment Checklist

Before deploying to production:

- [ ] Set strong JWT secret
- [ ] Configure secure admin credentials
- [ ] Enable HTTPS
- [ ] Set appropriate CORS origins
- [ ] Configure production storage adapter
- [ ] Build Studio for production
- [ ] Set up monitoring and logging
- [ ] Configure backups

## Environment Variables

### Required Variables

```bash
# Security
TROKKY_JWT_SECRET=your-256-bit-secret
TROKKY_ADMIN_USERNAME=admin
TROKKY_ADMIN_PASSWORD=secure-password

# Server
NODE_ENV=production
PORT=3000
```

### Optional Variables

```bash
# Storage (S3)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET=your-bucket
DYNAMODB_TABLE=your-table

# CORS
CORS_ORIGIN=https://your-domain.com

# Logging
LOG_LEVEL=info
```

## Platform Guides

### Node.js Server

Deploy to any Node.js hosting (Railway, Render, DigitalOcean, etc.)

#### 1. Build for Production

```bash
npm run build
npm run studio:build
```

#### 2. Production Server

```typescript
// server.ts
import express from 'express';
import { TrokkyExpress } from '@trokky/express';
import { schemas } from './schemas.js';

const app = express();

// Trust proxy for HTTPS detection
app.set('trust proxy', 1);

const trokky = await TrokkyExpress.create({
  schemas,
  storage: {
    adapter: 's3',
    region: process.env.AWS_REGION,
    bucket: process.env.S3_BUCKET,
    tableName: process.env.DYNAMODB_TABLE,
  },
  security: {
    jwtSecret: process.env.TROKKY_JWT_SECRET,
    adminUser: {
      username: process.env.TROKKY_ADMIN_USERNAME,
      password: process.env.TROKKY_ADMIN_PASSWORD,
    },
  },
  server: {
    cors: {
      origin: process.env.CORS_ORIGIN,
      credentials: true,
    },
  },
  studio: {
    enabled: true,
  },
});

trokky.mount(app);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

#### 3. Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY studio-build ./studio-build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/server.js"]
```

### Vercel (Next.js)

Deploy as a Next.js application with API routes.

#### 1. Install Next.js Integration

```bash
npm install @trokky/nextjs
```

#### 2. Create API Route

```typescript
// app/api/[...trokky]/route.ts
import { TrokkyNextjs } from '@trokky/nextjs';
import { schemas } from '@/schemas';

const trokky = TrokkyNextjs.create({
  schemas,
  storage: {
    adapter: 's3',
    region: process.env.AWS_REGION!,
    bucket: process.env.S3_BUCKET!,
    tableName: process.env.DYNAMODB_TABLE!,
  },
  security: {
    jwtSecret: process.env.TROKKY_JWT_SECRET!,
  },
});

export const { GET, POST, PUT, DELETE, PATCH } = trokky.handlers();
```

#### 3. Environment Variables

Add to Vercel dashboard or `.env.local`:

```bash
TROKKY_JWT_SECRET=...
AWS_REGION=...
S3_BUCKET=...
DYNAMODB_TABLE=...
```

### Cloudflare Workers

Deploy to the edge with Cloudflare Workers.

#### 1. Install Cloudflare Integration

```bash
npm install @trokky/cloudflare
```

#### 2. Worker Entry

```typescript
// src/index.ts
import { TrokkyCloudflare } from '@trokky/cloudflare';
import { schemas } from './schemas';

export default {
  async fetch(request: Request, env: Env) {
    const trokky = TrokkyCloudflare.create({
      schemas,
      storage: {
        adapter: 'cloudflare',
        d1: env.DB,
        r2: env.STORAGE,
      },
      security: {
        jwtSecret: env.JWT_SECRET,
      },
    });

    return trokky.handle(request);
  },
};
```

#### 3. Wrangler Configuration

```toml
# wrangler.toml
name = "trokky-cms"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "trokky"
database_id = "xxx"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "trokky-media"

[vars]
JWT_SECRET = "your-secret"
```

### AWS (EC2/ECS)

#### EC2 with PM2

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start dist/server.js --name trokky

# Configure startup
pm2 startup
pm2 save
```

#### ECS Task Definition

```json
{
  "family": "trokky",
  "containerDefinitions": [
    {
      "name": "trokky",
      "image": "your-ecr-repo/trokky:latest",
      "portMappings": [
        { "containerPort": 3000 }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" }
      ],
      "secrets": [
        { "name": "TROKKY_JWT_SECRET", "valueFrom": "arn:aws:..." }
      ]
    }
  ]
}
```

## HTTPS Configuration

### Behind Load Balancer

```typescript
// Trust proxy headers
app.set('trust proxy', 1);

// Force HTTPS redirect
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});
```

### Direct SSL

```typescript
import https from 'https';
import fs from 'fs';

const options = {
  key: fs.readFileSync('/path/to/key.pem'),
  cert: fs.readFileSync('/path/to/cert.pem'),
};

https.createServer(options, app).listen(443);
```

## Security Hardening

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // requests per window
});

app.use('/api', limiter);
```

### Security Headers

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));
```

### Input Validation

Trokky validates all input against schemas. Additional validation:

```typescript
import { body, validationResult } from 'express-validator';

app.post('/api/custom',
  body('email').isEmail(),
  body('name').trim().notEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // ...
  }
);
```

## Performance

### Caching

```typescript
// API response caching
app.use('/api/documents', (req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=60');
  }
  next();
});
```

### CDN for Media

Configure your CDN to serve from `/media`:

```typescript
media: {
  baseUrl: 'https://cdn.example.com',
}
```

### Compression

```typescript
import compression from 'compression';
app.use(compression());
```

## Monitoring

### Health Check

```typescript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

### Logging

```typescript
import morgan from 'morgan';

// Request logging
app.use(morgan('combined'));

// Error logging
app.use((err, req, res, next) => {
  console.error({
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });
  res.status(500).json({ error: 'Internal server error' });
});
```

## Backups

### Filesystem Backup

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y-%m-%d)
tar -czf backup-$DATE.tar.gz content/ uploads/
aws s3 cp backup-$DATE.tar.gz s3://backups/trokky/
```

### Database Backup

For S3/DynamoDB:

```bash
# Export DynamoDB table
aws dynamodb export-table-to-point-in-time \
  --table-arn arn:aws:dynamodb:... \
  --s3-bucket backups \
  --s3-prefix dynamodb/
```

## Scaling

### Horizontal Scaling

Trokky is stateless and can run multiple instances:

- Use external session store (Redis) for JWT blacklist
- Use S3 or Cloudflare R2 for media storage
- Put a load balancer in front

### Database Scaling

- DynamoDB: Enable auto-scaling
- Cloudflare D1: Use read replicas

## Next Steps

- [Configuration Reference](/reference/configuration/) - Full configuration options
- [HTTP API](/reference/http-api/) - API documentation
- [Troubleshooting](/reference/troubleshooting/) - Common issues and solutions
