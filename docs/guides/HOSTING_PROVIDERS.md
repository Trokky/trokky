# Hosting Providers for Trokky Node.js/Express

This guide covers deployment options for the Node.js/Express version of Trokky CMS, helping you choose the right hosting provider based on your needs, budget, and technical requirements.

## Platform-as-a-Service (PaaS) - Easiest Deployment

### Railway (Recommended for Traditional Apps)
**Best for:** Full-stack Node.js applications with persistent storage needs

**Pros:**
- Simple Git-based deployments
- Persistent storage perfect for filesystem adapter
- Built-in databases (PostgreSQL, MySQL, Redis)
- Excellent developer experience
- Reasonable pricing

**Cons:**
- Less global edge presence than major cloud providers

**Deployment Steps:**
1. Connect your Git repository
2. Railway auto-detects Node.js and runs `npm start`
3. Set environment variables in dashboard
4. Deploy automatically on Git push

**Environment Variables:**
```bash
NODE_ENV=production
JWT_SECRET=your-secure-jwt-secret
PORT=3000
```

**Storage Configuration:**
- Use filesystem adapter with persistent volumes
- Or configure PostgreSQL adapter with Railway's managed database

---

### Vercel (Recommended for Serverless)
**Best for:** Serverless deployments with edge distribution

**Pros:**
- Zero-config deployments
- Global edge network and CDN
- Excellent performance for static assets
- Git integration with preview deployments
- Free tier available

**Cons:**
- Serverless limitations (execution time, storage)
- Filesystem adapter requires modifications for serverless

**Deployment Steps:**
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in project directory
3. Configure `vercel.json` for API routes
4. Deploy with `vercel --prod`

**Configuration (`vercel.json`):**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/server.ts"
    }
  ]
}
```

---

### Render
**Best for:** Simple deployments with free tier

**Pros:**
- Free tier with persistent disks
- Auto-deployments from Git
- Built-in databases and Redis
- Good performance/price ratio
- SSL certificates included

**Cons:**
- Limited global presence
- Free tier has usage limitations

**Deployment Steps:**
1. Connect GitHub/GitLab repository
2. Select "Web Service"
3. Configure build and start commands
4. Set environment variables
5. Deploy automatically

**Build Configuration:**
- Build Command: `npm run build`
- Start Command: `npm start`
- Environment: Node.js

---

## Cloud Providers - Enterprise Grade

### Amazon Web Services (AWS)

#### AWS Elastic Beanstalk (Recommended for AWS)
**Best for:** Managed Node.js hosting with AWS ecosystem integration

**Deployment Steps:**
1. Install EB CLI: `pip install awsebcli`
2. Initialize: `eb init`
3. Create environment: `eb create production`
4. Deploy: `eb deploy`

**Storage Options:**
- **EFS (Elastic File System):** For filesystem adapter
- **S3 + DynamoDB:** For scalable storage adapters
- **RDS:** For database adapters (PostgreSQL, MySQL)

#### AWS ECS/Fargate
**Best for:** Containerized deployments with full control

**Deployment Steps:**
1. Create Dockerfile
2. Build and push to ECR
3. Create ECS service definition
4. Deploy with AWS CLI or Console

**Docker Configuration:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

---

### Google Cloud Platform (GCP)

#### Cloud Run (Recommended for GCP)
**Best for:** Serverless containers with automatic scaling

**Deployment Steps:**
1. Build container: `gcloud builds submit --tag gcr.io/PROJECT/trokky`
2. Deploy: `gcloud run deploy --image gcr.io/PROJECT/trokky`
3. Configure environment variables
4. Set up Cloud SQL for database needs

**Storage Options:**
- **Cloud Storage:** For media files
- **Firestore:** For document storage
- **Cloud SQL:** For relational data

#### App Engine
**Best for:** Managed Node.js runtime

**Configuration (`app.yaml`):**
```yaml
runtime: nodejs18
env: standard
automatic_scaling:
  min_instances: 1
  max_instances: 10
env_variables:
  NODE_ENV: production
  JWT_SECRET: your-secret
```

---

### DigitalOcean

#### App Platform (Recommended)
**Best for:** Balance of simplicity and control

**Pros:**
- Git-based deployments
- Managed databases available
- Good performance and pricing
- Simple configuration

**Deployment Steps:**
1. Connect GitHub repository
2. Configure app spec
3. Set environment variables
4. Deploy automatically

**App Spec Configuration:**
```yaml
name: trokky-cms
services:
- name: api
  source_dir: /
  github:
    repo: your-username/your-repo
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
```

#### Droplets (VPS)
**Best for:** Full control and custom configurations

**Setup Steps:**
1. Create Ubuntu droplet
2. Install Node.js and npm
3. Set up PM2 for process management
4. Configure Nginx reverse proxy
5. Set up SSL with Let's Encrypt

---

## Container Platforms

### Fly.io
**Best for:** Global deployment with persistent volumes

**Pros:**
- Global edge deployment
- Persistent volumes for filesystem adapter
- Simple deployment process
- Good performance

**Deployment Steps:**
1. Install flyctl CLI
2. Run `flyctl launch`
3. Configure `fly.toml`
4. Deploy with `flyctl deploy`

**Configuration (`fly.toml`):**
```toml
app = "trokky-cms"

[build]
  builder = "heroku/buildpacks:20"

[[services]]
  http_checks = []
  internal_port = 3000
  processes = ["app"]
  protocol = "tcp"
  script_checks = []

  [[services.ports]]
    force_https = true
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

[mounts]
  source = "trokky_data"
  destination = "/app/data"
```

---

## Self-Hosted Options

### VPS Providers
**Best for:** Full control and cost optimization

**Recommended Providers:**
- **DigitalOcean Droplets:** $5/month starter
- **Linode:** Good performance/price ratio
- **Vultr:** Global presence
- **AWS EC2:** Enterprise features
- **Hetzner:** Europe-focused, cost-effective

**Basic Setup (Ubuntu):**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 process manager
sudo npm install -g pm2

# Clone and setup your app
git clone your-repo
cd your-app
npm install --production

# Start with PM2
pm2 start server.js --name trokky
pm2 startup
pm2 save
```

### Docker Deployment
**Best for:** Consistent deployment across environments

**Docker Compose Setup:**
```yaml
version: '3.8'
services:
  trokky:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./content:/app/content
      - ./media:/app/media
      - ./users:/app/users
    environment:
      - NODE_ENV=production
      - JWT_SECRET=your-secret
    restart: unless-stopped
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - trokky
    restart: unless-stopped
```

---

## Recommendations by Use Case

### Development & Testing
- **Railway:** Free tier with persistent storage
- **Render:** Free tier for small projects
- **DigitalOcean Droplets:** $5/month for dedicated resources

### Small to Medium Production
- **Railway:** Simple deployment, good performance
- **DigitalOcean App Platform:** Balanced features and pricing
- **Render:** Cost-effective with managed services

### Large Scale Production
- **AWS ECS/Fargate:** Enterprise-grade scaling
- **Google Cloud Run:** Serverless with automatic scaling
- **Multi-region deployment** with appropriate storage adapters

### Cost-Conscious
- **Self-hosted VPS:** Maximum control, lowest cost
- **Hetzner:** European provider with competitive pricing
- **DigitalOcean:** Good balance of features and cost

---

## Storage Adapter Considerations

### Filesystem Adapter
**Compatible with:** Railway, Render, VPS, Docker
**Requires:** Persistent storage, not suitable for serverless

**Configuration:**
```javascript
storage: {
  data: {
    adapter: 'filesystem-data',
    options: {
      contentDir: './content',
      usersDir: './users',
      tokensDir: './tokens'
    }
  }
}
```

### Cloud Storage Adapters
**Compatible with:** All platforms
**Best for:** Serverless deployments, high availability

**AWS S3 + DynamoDB:**
```javascript
storage: {
  data: {
    adapter: 'dynamodb',
    options: {
      region: 'us-east-1',
      tablePrefix: 'trokky'
    }
  },
  media: {
    adapter: 's3',
    options: {
      bucket: 'trokky-media',
      region: 'us-east-1'
    }
  }
}
```

### Database Adapters
**Compatible with:** All platforms with database support
**Best for:** Structured data, complex queries

**PostgreSQL Configuration:**
```javascript
storage: {
  data: {
    adapter: 'postgresql',
    options: {
      connectionString: process.env.DATABASE_URL
    }
  }
}
```

---

## Environment Variables Checklist

Essential environment variables for production deployment:

```bash
# Required
NODE_ENV=production
JWT_SECRET=your-256-bit-secret-key

# Database (if using database adapter)
DATABASE_URL=postgresql://user:pass@host:port/db

# Media Storage (if using cloud storage)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET=your-media-bucket

# Optional
PORT=3000
MEDIA_BASE_URL=https://yourdomain.com
CORS_ORIGIN=https://yourstudio.com
```

---

## Security Considerations

### SSL/TLS Certificates
- **Let's Encrypt:** Free SSL certificates
- **Cloudflare:** Free SSL with CDN
- **Cloud Provider SSL:** Managed certificates

### Firewall Configuration
```bash
# UFW (Ubuntu Firewall)
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### Environment Security
- Use environment variables for secrets
- Never commit secrets to Git
- Use different JWT secrets per environment
- Implement rate limiting
- Keep dependencies updated

---

## Monitoring and Logging

### Application Monitoring
- **Railway:** Built-in metrics and logs
- **Vercel:** Analytics and performance monitoring
- **AWS CloudWatch:** Comprehensive monitoring
- **Google Cloud Monitoring:** Metrics and alerting

### Log Management
- **Structured logging** with JSON format
- **Log rotation** for file-based logging
- **Centralized logging** with services like:
  - **Datadog**
  - **New Relic**
  - **LogRocket**
  - **Papertrail**

### Health Checks
Implement health check endpoints:
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version
  })
})
```

---

## Cost Comparison (Approximate Monthly Costs)

| Provider | Starter | Production | Enterprise |
|----------|---------|------------|------------|
| Railway | Free → $5 | $20-50 | $100+ |
| Vercel | Free → $20 | $20-100 | $500+ |
| Render | Free → $7 | $25-100 | $200+ |
| DigitalOcean | $5 | $20-100 | $500+ |
| AWS | $10+ | $50-200 | $500+ |
| Google Cloud | $10+ | $50-200 | $500+ |
| Self-hosted VPS | $5 | $20-50 | $100+ |

*Costs vary based on traffic, storage, and additional services*

---

## Getting Started

1. **Choose your hosting provider** based on your needs
2. **Select appropriate storage adapters** for your deployment type
3. **Set up environment variables** for your chosen platform
4. **Configure monitoring and logging** for production readiness
5. **Implement CI/CD pipeline** for automated deployments
6. **Set up backup strategy** for your data and media files

For specific deployment guides, check the individual platform documentation and our example configurations in the `/examples` directory.