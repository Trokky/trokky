# Trokky Studio v2 Specification

**Version**: 2.0.0  
**Status**: Draft  
**Last Updated**: 2025-01-21

## Executive Summary

Trokky Studio v2 is a modern, simplified content management interface designed for easy deployment and minimal configuration. Unlike the legacy Studio which required complex setup, v2 focuses on **zero-config deployment** while maintaining the proven UX patterns from the legacy implementation.

## Core Design Principles

### 1. **Zero-Config Deployment**
- Single-file distribution (bundled SPA)
- Automatic backend discovery
- Self-configuring based on available schemas
- No build steps required for deployment

### 2. **Progressive Enhancement**
- Works with any Trokky backend
- Graceful degradation when features unavailable
- Runtime feature detection

### 3. **Modern Architecture**
- React 18 with concurrent features
- Vite for development and building
- TypeScript throughout
- Tailwind CSS for styling

### 4. **Proven UX Patterns**
- Header + 3-panel layout from legacy
- Modal-based global search
- Resizable context-sensitive panels
- Permission-aware interface

## Architecture Overview

### Technology Stack

```typescript
// Core Dependencies
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "typescript": "^5.0.0",
  "vite": "^5.0.0",
  "tailwindcss": "^3.4.0",
  "react-router-dom": "^6.8.0",
  "@tanstack/react-query": "^5.0.0",
  "zustand": "^4.4.0",
  "fuse.js": "^7.0.0",
  "@headlessui/react": "^1.7.0",
  "@heroicons/react": "^2.0.0"
}
```

### Project Structure

```
packages/studio/
├── public/
│   ├── index.html           # Single entry point
│   └── studio-config.js     # Optional runtime config
├── src/
│   ├── app/                 # App-level components
│   │   ├── App.tsx
│   │   ├── Router.tsx
│   │   └── ErrorBoundary.tsx
│   ├── components/          # Reusable UI components
│   │   ├── layout/          # Layout components
│   │   ├── search/          # Search components
│   │   ├── forms/           # Form components
│   │   ├── media/           # Media components
│   │   └── ui/              # Base UI components
│   ├── hooks/               # Custom React hooks
│   ├── services/            # API and business logic
│   ├── stores/              # Zustand state stores
│   ├── types/               # TypeScript definitions
│   └── utils/               # Utility functions
├── dist/                    # Built output (single-file deployment)
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## Core Features

### 1. **Auto-Discovery System**

```typescript
interface StudioConfig {
  // Runtime discovery
  backend: {
    url: string;              // Auto-detected from window.location
    apiVersion: string;       // Discovered via /api/version
    features: string[];       // Capabilities discovered via /api/capabilities
  };
  
  // Optional overrides
  branding?: {
    title: string;
    logo?: string;
    theme?: ThemeConfig;
  };
  
  // Feature toggles
  features?: {
    search: boolean;
    media: boolean;
    users: boolean;
    workflows: boolean;
  };
}
```

### 2. **Layout System**

#### Header Component
```typescript
interface HeaderProps {
  // Auto-adapts based on available features
  showSearch?: boolean;      // Based on backend capabilities
  showMedia?: boolean;       // Based on media endpoint availability
  showUserMenu?: boolean;    // Based on auth system
}

export function Header({ showSearch, showMedia, showUserMenu }: HeaderProps) {
  // Responsive header with:
  // - Logo/branding (configurable)
  // - Global search (if backend supports it)
  // - Quick actions (create, media)
  // - User menu with theme toggle
  // - Mobile hamburger menu
}
```

#### Three-Panel Layout
```typescript
interface LayoutProps {
  children: React.ReactNode;
}

export function StudioLayout({ children }: LayoutProps) {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <MainSidebar />       {/* Structure-based navigation */}
        <ContextSidebar />    {/* Context-sensitive content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 3. **Structure Integration**

The Studio automatically integrates with the Structure System:

```typescript
interface StudioStructureIntegration {
  // Auto-discovery of structure configuration
  discoverStructure: () => Promise<TrokkyStructure | null>;
  
  // Fallback navigation when no structure defined
  generateDefaultNavigation: (schemas: Schema[]) => NavigationItem[];
  
  // Structure-driven routing
  generateRoutes: (structure: TrokkyStructure) => RouteDefinition[];
}

// Example auto-generated navigation
const generateDefaultNavigation = (schemas: Schema[]): NavigationItem[] => [
  { id: 'dashboard', title: 'Dashboard', href: '/', icon: 'home' },
  ...schemas.map(schema => ({
    id: schema.name,
    title: schema.title || schema.name,
    href: `/content/${schema.name}`,
    icon: schema.icon || 'document'
  })),
  { id: 'media', title: 'Media', href: '/media', icon: 'photo' },
  { id: 'settings', title: 'Settings', href: '/settings', icon: 'cog' }
];
```

### 4. **Smart Search System**

Building on the legacy search but simplified:

```typescript
interface SearchConfig {
  // Auto-configured based on backend capabilities
  endpoints: {
    documents: boolean;
    media: boolean;
    users: boolean;
  };
  
  // Search behavior
  fuzzySearch: boolean;      // Default: true
  debounceMs: number;        // Default: 200
  maxResults: number;        // Default: 20
}

class SearchService {
  // Simplified search that works with any backend
  async search(query: string): Promise<SearchResult[]> {
    const endpoints = this.discoverSearchEndpoints();
    const results = await Promise.allSettled([
      endpoints.documents && this.searchDocuments(query),
      endpoints.media && this.searchMedia(query),
      endpoints.users && this.searchUsers(query)
    ].filter(Boolean));
    
    return this.mergeResults(results);
  }
  
  // Auto-discovery of search capabilities
  private discoverSearchEndpoints(): SearchEndpoints {
    // Check what endpoints are available
    // Fallback to client-side search if needed
  }
}
```

### 5. **Zero-Config Media Management**

```typescript
interface MediaConfig {
  // Auto-detected upload capabilities
  upload: {
    endpoint: string;         // Discovered from backend
    maxSize: number;          // From backend limits
    acceptedTypes: string[];  // From backend capabilities
  };
  
  // Display options
  grid: {
    columns: { mobile: 2, tablet: 3, desktop: 4 };
    aspectRatio: 'square' | 'auto';
  };
}

// Self-configuring media component
export function MediaManager() {
  const config = useMediaConfig(); // Auto-discovered
  const upload = useMediaUpload(); // Auto-configured
  
  return (
    <div className="media-manager">
      {config.upload.endpoint && <UploadZone />}
      <MediaGrid />
      <MediaModal />
    </div>
  );
}
```

## Deployment Models

### 1. **Static Deployment** (Primary)

```bash
# Build for static deployment
npm run build

# Output: single HTML file with inlined assets
dist/
└── index.html              # ~2MB self-contained file
```

**Features:**
- Single file deployment
- Works with any static host (Netlify, Vercel, S3, etc.)
- No server configuration required
- Auto-discovers backend from URL

### 2. **Docker Deployment**

```dockerfile
FROM nginx:alpine
COPY dist/index.html /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

**Features:**
- Containerized deployment
- Includes optimized nginx config
- Health checks included

### 3. **CDN Deployment**

```javascript
// Auto-configuring CDN version
<script src="https://cdn.trokky.com/studio/v2/studio.js"></script>
<script>
  TrokkyStudio.mount('#app', {
    backend: '/api',  // Your backend URL
    theme: 'auto'     // Optional customization
  });
</script>
```

## Configuration System

### Runtime Configuration

The Studio can be configured at runtime without rebuilding:

```javascript
// public/studio-config.js (optional)
window.TROKKY_STUDIO_CONFIG = {
  branding: {
    title: 'My CMS',
    logo: '/logo.png',
    theme: {
      primary: '#3b82f6',
      background: '#ffffff'
    }
  },
  
  features: {
    search: true,
    media: true,
    users: false,        // Disable user management
    workflows: false     // Disable workflows
  },
  
  defaults: {
    pageSize: 25,
    dateFormat: 'MM/dd/yyyy',
    timeZone: 'America/New_York'
  }
};
```

### Environment-Based Configuration

```typescript
interface EnvironmentConfig {
  // Auto-detected from environment
  development: {
    hotReload: boolean;
    debugMode: boolean;
    apiLogging: boolean;
  };
  
  production: {
    analytics?: string;      // Optional analytics endpoint
    errorReporting?: string; // Optional error reporting
    caching: boolean;        // Default: true
  };
}
```

## API Integration

### Auto-Discovery Protocol

```typescript
interface BackendDiscovery {
  // Check backend capabilities
  discover: () => Promise<BackendCapabilities>;
  
  // Graceful degradation
  fallbackMode: () => void;
}

interface BackendCapabilities {
  version: string;
  features: {
    search: boolean;
    media: boolean;
    auth: boolean;
    structure: boolean;
    workflows: boolean;
  };
  
  endpoints: {
    documents: string;
    media?: string;
    auth?: string;
    structure?: string;
  };
  
  limits: {
    maxUploadSize: number;
    maxResults: number;
    requestRate: number;
  };
}
```

### Client Integration

```typescript
class StudioClient {
  constructor(private baseUrl: string) {}
  
  // Auto-configuring client
  static async create(baseUrl?: string): Promise<StudioClient> {
    const url = baseUrl || this.detectBackendUrl();
    const capabilities = await this.discoverCapabilities(url);
    return new StudioClient(url, capabilities);
  }
  
  // Graceful degradation
  async query<T>(endpoint: string, fallback?: () => T): Promise<T> {
    try {
      return await this.request(endpoint);
    } catch (error) {
      if (fallback) return fallback();
      throw error;
    }
  }
}
```

## Performance Requirements

### Bundle Size Targets
- **Initial bundle**: < 500KB gzipped
- **Route chunks**: < 100KB each
- **Total runtime**: < 2MB including all assets

### Performance Metrics
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3s
- **Core Web Vitals**: All green scores

### Optimization Strategies
- Code splitting by route
- Dynamic imports for features
- Service worker for caching
- Preload critical resources

## Security Considerations

### Client-Side Security
```typescript
interface SecurityConfig {
  // Content Security Policy
  csp: {
    scriptSrc: string[];
    styleSrc: string[];
    imgSrc: string[];
  };
  
  // XSS prevention
  sanitization: {
    htmlFields: boolean;
    scriptBlocking: boolean;
  };
  
  // CSRF protection
  csrf: {
    tokenHeader: string;
    cookieName: string;
  };
}
```

### Authentication Integration
```typescript
interface AuthConfig {
  // Auto-detected auth system
  provider: 'jwt' | 'session' | 'oauth' | 'custom';
  
  // Token handling
  storage: 'localStorage' | 'sessionStorage' | 'cookie';
  refreshInterval: number;
  
  // Logout behavior
  logoutUrl?: string;
  redirectAfterLogout?: string;
}
```

## Testing Strategy

### Unit Tests
- Component testing with React Testing Library
- Hook testing with custom test utilities
- Service layer testing with mocked APIs

### Integration Tests
- E2E testing with Playwright
- Visual regression testing
- Performance testing

### Browser Support
- **Modern browsers**: Full support (Chrome 90+, Firefox 88+, Safari 14+)
- **Legacy browsers**: Graceful degradation with polyfills
- **Mobile browsers**: iOS Safari 14+, Chrome Mobile 90+

## Development Workflow

### Local Development
```bash
# Start development server
npm run dev

# Runs on http://localhost:5173
# Auto-detects backend on :3000 or uses proxy
```

### Building
```bash
# Development build
npm run build:dev

# Production build with optimizations
npm run build

# Analyze bundle size
npm run analyze
```

### Preview
```bash
# Preview production build locally
npm run preview
```

## Migration Path from Legacy

### Compatibility Layer
```typescript
interface LegacyCompatibility {
  // Support legacy structure format
  convertLegacyStructure: (v1Structure: any) => TrokkyStructure;
  
  // Migrate user preferences
  migrateLegacySettings: () => StudioSettings;
  
  // API compatibility
  adaptLegacyEndpoints: (endpoints: any) => ModernEndpoints;
}
```

### Migration Steps
1. **Assessment**: Auto-detect legacy installation
2. **Backup**: Export current settings and structure
3. **Deploy**: Deploy new Studio alongside legacy
4. **Migrate**: Gradual migration of users
5. **Cleanup**: Remove legacy when migration complete

## Implementation Phases

### Phase 1: Foundation (MVP)
- [ ] Basic layout system
- [ ] Auto-discovery system
- [ ] Simple content management
- [ ] Static deployment ready

**Timeline**: 2-3 weeks

### Phase 2: Core Features
- [ ] Global search implementation
- [ ] Media management
- [ ] Structure system integration
- [ ] Basic customization

**Timeline**: 3-4 weeks

### Phase 3: Advanced Features
- [ ] User management integration
- [ ] Workflow support
- [ ] Advanced customization
- [ ] Performance optimizations

**Timeline**: 2-3 weeks

### Phase 4: Polish & Launch
- [ ] Comprehensive testing
- [ ] Documentation
- [ ] Migration tools
- [ ] Launch preparation

**Timeline**: 2 weeks

## Success Metrics

### Developer Experience
- **Setup time**: < 5 minutes from download to running
- **Deployment time**: < 2 minutes to production
- **Learning curve**: Intuitive for users familiar with modern CMSs

### User Experience
- **Page load time**: < 2 seconds on 3G
- **Search response time**: < 300ms
- **Mobile usability**: Full feature parity on mobile devices

### Operational
- **Bundle size**: < 2MB total
- **Memory usage**: < 100MB browser memory
- **Compatibility**: 95%+ browser support

## Future Enhancements

### Planned Features
- **Plugin system**: Runtime plugin loading
- **Themes marketplace**: Community themes
- **Advanced workflows**: Visual workflow builder
- **Real-time collaboration**: Multi-user editing

### Extension Points
```typescript
interface StudioExtensions {
  // Plugin system
  plugins: {
    register: (plugin: StudioPlugin) => void;
    load: (pluginId: string) => Promise<void>;
  };
  
  // Theme system
  themes: {
    register: (theme: StudioTheme) => void;
    apply: (themeId: string) => void;
  };
  
  // Custom fields
  fields: {
    register: (field: CustomField) => void;
    render: (fieldType: string, props: any) => React.Component;
  };
}
```

## Conclusion

Trokky Studio v2 represents a significant simplification and modernization of the content management experience. By focusing on zero-config deployment and proven UX patterns, we create a Studio that's both powerful and easy to use.

The modular architecture and auto-discovery system ensure that the Studio works well with any Trokky backend while providing a consistent, modern interface that content creators will love.

Key advantages over legacy:
- **10x simpler deployment** (single file vs complex setup)
- **Modern technology stack** (React 18, TypeScript, Vite)
- **Better performance** (< 2MB vs > 10MB legacy bundle)
- **Mobile-first design** (responsive from the ground up)
- **Zero configuration** (auto-discovers backend capabilities)

This specification provides the foundation for building a Studio that's worthy of the Trokky v2 ecosystem while being accessible to developers and content creators alike.