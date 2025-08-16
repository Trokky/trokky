/**
 * Service for fetching and managing Studio configuration from API
 */

import type { ApiClient } from './api-client'
import { createStudioLogger } from '@/utils/logger'

const logger = createStudioLogger('config-service')

export interface StudioBranding {
  title?: string
  logo?: string
  theme?: 'light' | 'dark' | 'system'
}

export interface StudioConfigData {
  branding?: StudioBranding
  enabled?: boolean
  path?: string
  requireAuth?: boolean
  [key: string]: any
}

export class StudioConfigService {
  private client: ApiClient
  private cachedConfig: StudioConfigData | null = null

  constructor(client: ApiClient) {
    this.client = client
  }

  /**
   * Fetch studio configuration from API and merge with window config
   */
  async fetchAndMergeConfig(): Promise<StudioConfigData> {
    if (this.cachedConfig) {
      return this.cachedConfig
    }

    try {
      // Try to fetch from API
      const response = await this.client.get('/config/studio')
      
      if (response.success && response.data && (response.data as any).studioConfig) {
        const apiConfig = (response.data as any).studioConfig
        
        // Merge API config with existing window config
        const existingConfig = (window as any).TROKKY_CONFIG || {}
        const mergedConfig = {
          ...existingConfig,
          branding: {
            ...existingConfig.branding,
            ...apiConfig.branding
          }
        }
        
        // Update window config with API data
        ;(window as any).TROKKY_CONFIG = mergedConfig
        
        this.cachedConfig = apiConfig
        logger.debug('Config updated from API', {
          title: apiConfig.branding?.title,
          hasConfig: !!apiConfig
        })
        
        return apiConfig
      }
    } catch (error) {
      logger.warn('Failed to fetch config from API, falling back to window config', error)
    }

    // Fallback to window config if API fails
    const windowConfig = (window as any).TROKKY_CONFIG || {}
    this.cachedConfig = windowConfig
    return windowConfig
  }

  /**
   * Get current branding configuration
   */
  async getBranding(): Promise<StudioBranding> {
    const config = await this.fetchAndMergeConfig()
    return config.branding || { title: 'Trokky Studio' }
  }

  /**
   * Clear cached config (useful for development)
   */
  clearCache(): void {
    this.cachedConfig = null
  }
}

// Singleton instance
let configService: StudioConfigService | null = null

export function getStudioConfigService(client: ApiClient): StudioConfigService {
  if (!configService) {
    configService = new StudioConfigService(client)
  }
  return configService
}