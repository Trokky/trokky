# Trokky Domain Strategy

This document outlines the official domain allocation and purpose for the Trokky ecosystem.

## Domain Allocation

| Domain         | Purpose                                      | Status       |
|----------------|----------------------------------------------|--------------|
| trokky.dev     | Documentation (Astro Starlight)              | Deploy now   |
| trokky.com     | Main commercial website                      | Future       |
| trokky.cloud   | Cloud-hosted SaaS (managed Trokky instances) | Future       |
| trokky.io      | Studio/App dashboard for cloud users         | Future       |
| trokky.ai      | AI features marketing page (or redirect)     | Future       |
| ontrokky.com   | Showcase of sites "Built on Trokky"          | Future       |
| trokky.build   | CI/CD, build status, or redirect to docs     | Optional     |
| trokky.net     | API endpoints / CDN / Infrastructure         | Optional     |

## Domain Purpose Details

### trokky.dev (Documentation)

Primary developer documentation site built with Astro Starlight.

- Getting started guides
- API reference
- Package documentation
- Integration tutorials
- Schema reference

### trokky.com (Commercial)

Main marketing and commercial website.

- Product overview
- Pricing
- Company information
- Blog
- Contact

### trokky.cloud (SaaS Platform)

Cloud-hosted managed Trokky instances.

- Marketing for cloud offering
- Signup and onboarding
- Cloud-specific documentation

### trokky.io (Application Dashboard)

User-facing dashboard for cloud customers.

- Project management
- Team management
- Billing and plans
- API token management
- Usage analytics

### trokky.net (Infrastructure)

Backend infrastructure and API services.

Potential subdomains:
- `api.trokky.net` - Public API endpoints
- `cdn.trokky.net` - Content delivery
- `registry.trokky.net` - NPM package registry/proxy

### trokky.ai (AI Features)

Reserved for AI-powered features and capabilities.

- AI content generation
- Smart schema suggestions
- Automated translations

May redirect to trokky.com until AI features are launched.

### ontrokky.com (Showcase)

Customer showcase and social proof.

- Sites built with Trokky
- Case studies
- Customer testimonials
- Community highlights

### trokky.build (Build Tools)

CI/CD and build-related services.

- Build status pages
- Deployment previews
- Integration status

May redirect to documentation if not actively used.

## Current Infrastructure

### Temporary Setup

- `admin.trokky.com` - Currently handles NPM proxy, client management, tokens, and plans

### Migration Plan

When transitioning to the final structure:

| Current (admin.trokky.com) | Future Location              |
|----------------------------|------------------------------|
| NPM proxy/registry         | registry.trokky.net          |
| Client dashboard           | trokky.io                    |
| Plans/billing              | trokky.io                    |
| API tokens                 | trokky.io                    |

## Redirects

Until all domains are actively used, configure redirects:

| From           | To                  | When                    |
|----------------|---------------------|-------------------------|
| trokky.com     | trokky.dev          | Until commercial launch |
| trokky.io      | trokky.dev          | Until app launch        |
| trokky.net     | trokky.dev          | Until infra setup       |
| trokky.build   | trokky.dev          | Until CI/CD setup       |
| trokky.ai      | trokky.dev          | Until AI features       |

## Priority Roadmap

1. **Now**: Deploy documentation to trokky.dev
2. **Phase 2**: Launch trokky.com (commercial site)
3. **Phase 3**: Launch trokky.cloud and trokky.io (SaaS platform)
4. **Phase 4**: Configure trokky.net infrastructure
5. **Future**: ontrokky.com showcase, trokky.ai features, trokky.build tools
