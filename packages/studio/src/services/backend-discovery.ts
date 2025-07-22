import type { BackendCapabilities } from '@/types';
import { createStudioLogger } from '../utils/logger';

export class BackendDiscoveryError extends Error {
  constructor(message: string, public readonly strategy?: string) {
    super(message);
    this.name = 'BackendDiscoveryError';
  }
}

export interface DiscoveryStrategy {
  name: string;
  discover: () => Promise<string | null>;
}

export class BackendDiscovery {
  private cache = new Map<string, { data: BackendCapabilities; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private logger = createStudioLogger('BackendDiscovery');

  /**
   * Discover backend URL using multiple strategies
   */
  async discoverBackend(): Promise<string> {
    const strategies = this.getDiscoveryStrategies();
    
    for (const strategy of strategies) {
      try {
        this.logger.debug(`Trying discovery strategy: ${strategy.name}`);
        const url = await strategy.discover();
        
        if (url) {
          this.logger.debug(`Found potential backend: ${url}`);
          const validated = await this.validateBackend(url);
          if (validated) {
            this.logger.info(`Backend validated: ${url}`);
            return url;
          }
        }
      } catch (error) {
        this.logger.warn(`Strategy ${strategy.name} failed`, error);
        continue;
      }
    }
    
    throw new BackendDiscoveryError('No valid Trokky backend found');
  }

  /**
   * Validate that a URL points to a valid Trokky backend
   */
  async validateBackend(url: string): Promise<boolean> {
    try {
      // Try the info endpoint
      const response = await fetch(`${url}/info`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        // Don't send credentials for discovery
        credentials: 'omit'
      });
      
      if (!response.ok) {
        return false;
      }
      
      const info = await response.json();
      
      // Check if it's a Trokky backend
      return info?.name === 'trokky' || info?.product === 'trokky';
    } catch (error) {
      this.logger.warn(`Backend validation failed for ${url}`, error);
      return false;
    }
  }

  /**
   * Discover backend capabilities
   */
  async discoverCapabilities(baseUrl: string): Promise<BackendCapabilities> {
    // Check cache first
    const cacheKey = baseUrl;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      // Get basic info
      const infoResponse = await fetch(`${baseUrl}/info`);
      const info = await infoResponse.json();
      
      // Use capabilities from info endpoint directly (no need to probe)
      const capabilities: BackendCapabilities = {
        version: info.version || '1.0.0',
        features: info.capabilities || {
          search: false,
          media: false,
          auth: false,
          structure: false,
          workflows: false
        },
        endpoints: {
          documents: `${baseUrl}/api/collections`,
          ...(info.capabilities?.media && { media: `${baseUrl}/api/media` }),
          ...(info.capabilities?.auth && { auth: `${baseUrl}/api/auth` }),
          ...(info.capabilities?.structure && { structure: `${baseUrl}/api/structure` }),
          ...(info.capabilities?.auth && { users: `${baseUrl}/api/users` })
        },
        limits: {
          maxUploadSize: info.limits?.maxUploadSize || 100 * 1024 * 1024, // 100MB default
          maxResults: info.limits?.maxResults || 100,
          requestRate: info.limits?.requestRate || 1000
        }
      };

      // Cache the result
      this.cache.set(cacheKey, { data: capabilities, timestamp: Date.now() });
      
      return capabilities;
    } catch (error) {
      throw new BackendDiscoveryError(`Failed to discover capabilities: ${error}`);
    }
  }

  /**
   * Test if an endpoint exists and is accessible
   */
  // Removed testEndpoint method as we now use /info endpoint directly

  /**
   * Get all discovery strategies in priority order
   */
  private getDiscoveryStrategies(): DiscoveryStrategy[] {
    return [
      {
        name: 'window-config',
        discover: () => this.checkWindowConfig()
      },
      {
        name: 'meta-tag',
        discover: () => this.checkMetaTags()
      },
      {
        name: 'url-params',
        discover: () => this.checkUrlParams()
      },
      {
        name: 'localStorage',
        discover: () => this.checkLocalStorage()
      },
      {
        name: 'same-origin',
        discover: () => this.checkSameOrigin()
      },
      {
        name: 'common-ports',
        discover: () => this.checkCommonPorts()
      }
    ];
  }

  /**
   * Check window.TROKKY_CONFIG or window.TROKKY_STUDIO_CONFIG
   */
  private async checkWindowConfig(): Promise<string | null> {
    const config = window.TROKKY_CONFIG || window.TROKKY_STUDIO_CONFIG;
    if (window.TROKKY_CONFIG?.backendUrl) {
      return window.TROKKY_CONFIG.backendUrl;
    }
    return (config as any)?.backend?.url || null;
  }

  /**
   * Check for meta tag configuration
   */
  private async checkMetaTags(): Promise<string | null> {
    const meta = document.querySelector('meta[name="trokky-api"]');
    return meta?.getAttribute('content') || null;
  }

  /**
   * Check URL parameters
   */
  private async checkUrlParams(): Promise<string | null> {
    const params = new URLSearchParams(window.location.search);
    return params.get('api') || params.get('backend') || null;
  }

  /**
   * Check localStorage for previously saved backend
   */
  private async checkLocalStorage(): Promise<string | null> {
    try {
      return localStorage.getItem('trokky_backend_url');
    } catch {
      return null;
    }
  }

  /**
   * Check same origin with common API paths
   */
  private async checkSameOrigin(): Promise<string | null> {
    const origin = window.location.origin;
    const commonPaths = ['/api', '/api/v1', '/api/v2'];
    
    for (const path of commonPaths) {
      const url = `${origin}${path}`;
      if (await this.validateBackend(url)) {
        return url;
      }
    }
    
    return null;
  }

  /**
   * Check common development ports
   */
  private async checkCommonPorts(): Promise<string | null> {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    
    // Only check localhost/127.0.0.1 for security
    if (!['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname)) {
      return null;
    }
    
    const commonPorts = [3000, 3001, 8000, 8080, 4000, 5000];
    
    for (const port of commonPorts) {
      // Skip current port to avoid infinite loops
      if (port.toString() === window.location.port) {
        continue;
      }
      
      const url = `${protocol}//${hostname}:${port}/api`;
      if (await this.validateBackend(url)) {
        return url;
      }
    }
    
    return null;
  }

  /**
   * Save discovered backend URL for future use
   */
  saveBackendUrl(url: string): void {
    try {
      localStorage.setItem('trokky_backend_url', url);
    } catch (error) {
      this.logger.warn('Failed to save backend URL', error);
    }
  }

  /**
   * Clear cached backend URL
   */
  clearSavedBackend(): void {
    try {
      localStorage.removeItem('trokky_backend_url');
    } catch (error) {
      this.logger.warn('Failed to clear saved backend', error);
    }
  }

  /**
   * Clear capabilities cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}