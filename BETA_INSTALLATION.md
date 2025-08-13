# 🔒 Trokky v2 Beta - Private Installation Guide

> **Private Beta Access Only** - This guide is for authorized beta testers and clients.

## 📋 Prerequisites

1. **GitHub Account** with access to the Trokky organization
2. **Node.js 18+** installed on your system
3. **GitHub Personal Access Token** with packages:read permission

## 🔑 GitHub Personal Access Token Setup

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select these permissions:
   - ✅ `read:packages` - Download packages from GitHub Packages
   - ✅ `read:org` - Read organization data (if needed)
4. Set expiration (recommend 90 days for beta period)
5. Copy the token (you won't see it again!)

## 🏗️ Project Setup

### 1. Create `.npmrc` File

In your project root, create a `.npmrc` file:

```bash
# .npmrc
@trokky:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN_HERE
```

**Replace `YOUR_GITHUB_TOKEN_HERE` with your actual token.**

### 2. Install Trokky Packages

```bash
# Install core CMS packages
npm install @trokky/core @trokky/express @trokky/fields

# Install storage adapters (choose what you need)
npm install @trokky/adapter-filesystem        # File-based storage
npm install @trokky/adapter-cloudflare        # Cloudflare Workers

# Install client SDK (optional)
npm install @trokky/client
```

### 3. Environment Variables

Create a `.env` file in your project:

```bash
# .env
# GitHub token for package access (development only)
NPM_TOKEN=your_github_token_here

# Trokky configuration
TROKKY_JWT_SECRET=your-super-secret-jwt-key-here
TROKKY_ADMIN_EMAIL=admin@yourcompany.com
TROKKY_ADMIN_PASSWORD=secure-admin-password
```

## 🚀 Quick Start Example

### Express.js Integration

```typescript
// server.ts
import express from 'express'
import { TrokkyExpress } from '@trokky/express'

const app = express()

// Define your content schemas
const schemas = [
  {
    name: 'article',
    title: 'Article',
    type: 'document',
    fields: {
      title: { type: 'string', title: 'Title', required: true },
      content: { type: 'richtext', title: 'Content' },
      publishedAt: { type: 'date', title: 'Published At' }
    }
  }
]

// Initialize Trokky
const trokky = await TrokkyExpress.create({
  schemas,
  storage: { 
    adapter: 'filesystem', 
    contentDir: './content' 
  },
  security: { 
    adminUser: { 
      username: process.env.TROKKY_ADMIN_EMAIL,
      password: process.env.TROKKY_ADMIN_PASSWORD 
    } 
  },
  studio: { 
    enabled: true,
    branding: { title: 'My CMS' } 
  }
})

// Mount Trokky (adds /api/* and /studio/* routes)
trokky.mount(app)

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000')
  console.log('Studio available at http://localhost:3000/studio')
})
```

### Frontend Client Usage

```typescript
// client.ts
import { TrokkyClient } from '@trokky/client'

const client = new TrokkyClient({
  baseUrl: 'http://localhost:3000',
  token: 'your-jwt-token-from-login'
})

// Get all articles
const articles = await client.documents.query('article')

// Create new article
const newArticle = await client.documents.create('article', {
  title: 'My First Article',
  content: 'Article content here...',
  publishedAt: new Date()
})
```

## 🔧 Development Workflow

### 1. Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Access Studio
open http://localhost:3000/studio
```

### 2. Building for Production

```bash
# Build your application
npm run build

# Start production server
npm start
```

## 📚 Available Packages

| Package | Description | Install Command |
|---------|-------------|-----------------|
| `@trokky/core` | Core CMS engine | `npm install @trokky/core` |
| `@trokky/express` | Express.js integration | `npm install @trokky/express` |
| `@trokky/fields` | Field system & components | `npm install @trokky/fields` |
| `@trokky/client` | Frontend SDK & type generation | `npm install @trokky/client` |
| `@trokky/studio` | Admin interface | `npm install @trokky/studio` |
| `@trokky/adapter-filesystem` | File-based storage | `npm install @trokky/adapter-filesystem` |
| `@trokky/adapter-cloudflare` | Cloudflare storage | `npm install @trokky/adapter-cloudflare` |

## 🐛 Troubleshooting

### Package Installation Issues

**Error: "Unable to authenticate, need: Bearer authorization_uri"**
- Check your `.npmrc` file is in the project root
- Verify your GitHub token has `packages:read` permission
- Ensure token is not expired

**Error: "404 Not Found - GET https://npm.pkg.github.com/@trokky/core"**
- Verify you have access to the Trokky organization
- Check that the package name is correct
- Confirm you're using the correct registry

### Authentication Issues

**Error: "Invalid JWT token"**
- Check `TROKKY_JWT_SECRET` is set in your environment
- Verify admin credentials in `.env` file
- Try clearing browser storage and logging in again

## 📞 Beta Support

During the beta period, you can reach out for support:

1. **GitHub Issues** - For bugs and feature requests
2. **Private Discord** - For real-time support (invite provided separately)
3. **Email** - beta@trokky.dev for urgent issues

## 🔒 Security Notes

1. **Never commit `.npmrc` with tokens** to version control
2. **Use environment variables** for sensitive configuration
3. **Rotate tokens regularly** (every 90 days recommended)
4. **Limit token permissions** to only what's needed

## 📈 Beta Feedback

We value your feedback! Please report:
- 🐛 Bugs and issues
- 💡 Feature requests
- 📖 Documentation improvements
- 🎯 Use case scenarios

---

**Welcome to Trokky v2 Beta!** 🎉

*This is a private beta. Please don't share this documentation or access tokens publicly.*