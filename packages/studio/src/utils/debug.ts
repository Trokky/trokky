/**
 * Debug utilities for Trokky Studio development
 */

import { createStudioLogger } from './logger'
import { getStructureService } from '../services/structure-service'
import { authStore } from '@/services/auth-store'

const logger = createStudioLogger('Debug')

export interface TrokkyDebugInterface {
  clearStructureCache(): void
  refreshStructure(): Promise<void>
  getStructureInfo(): Promise<any>
  clearAllCache(): void
  enableDebugLogging(): void
  disableDebugLogging(): void
}

/**
 * Debug utilities for development and troubleshooting
 */
export const TrokkyDebug: TrokkyDebugInterface = {
  /**
   * Clear structure cache and force reload
   */
  clearStructureCache(): void {
    try {
      const structureService = getStructureService()
      structureService.clearCache()
      logger.info('✅ Structure cache cleared')
      
      // Also clear browser storage
      try {
        localStorage.removeItem('trokky_structure_cache')
        sessionStorage.removeItem('trokky_structure_cache')
        logger.info('✅ Browser structure cache cleared')
      } catch (error) {
        logger.warn('⚠️ Could not clear browser cache:', error)
      }
    } catch (error) {
      logger.error('❌ Failed to clear structure cache:', error)
    }
  },

  /**
   * Force refresh structure from API endpoint
   */
  async refreshStructure(): Promise<void> {
    try {
      const structureService = getStructureService()
      const structure = await structureService.refreshFromEndpoint()
      
      if (structure) {
        logger.info('✅ Structure refreshed from endpoint:', {
          title: structure.title,
          itemsCount: structure.items?.length || 0
        })
      } else {
        logger.warn('⚠️ No structure returned from endpoint, falling back to defaults')
      }
    } catch (error) {
      logger.error('❌ Failed to refresh structure:', error)
    }
  },

  /**
   * Get current structure information for debugging
   */
  async getStructureInfo(): Promise<any> {
    try {
      const structureService = getStructureService()
      const structure = await structureService.getStructure()
      
      const info = {
        cached: structureService.isCached(),
        title: structure.title,
        itemsCount: structure.items?.length || 0,
        metadata: structure.metadata,
        items: structure.items?.map((item: any) => ({
          type: item.type,
          title: item.title,
          schemaType: item.schemaType,
          hasChildren: !!item.items?.length
        }))
      }
      
      logger.info('📊 Current structure info:', info)
      return info
    } catch (error) {
      logger.error('❌ Failed to get structure info:', error)
      return { error: error instanceof Error ? error.message : String(error) }
    }
  },

  /**
   * Clear all browser caches
   */
  clearAllCache(): void {
    try {
      // Clear structure cache
      this.clearStructureCache()
      
      // The session lives in the auth store, which owns both token keys
      authStore.clear()

      // Clear other potential caches
      const cacheKeys = [
        'trokky_user_data',
        'trokky_theme',
        'trokky_sidebar_collapsed',
        'trokky_studio_config'
      ]
      
      cacheKeys.forEach(key => {
        try {
          localStorage.removeItem(key)
          sessionStorage.removeItem(key)
        } catch (error) {
          // Ignore errors for individual keys
        }
      })
      
      logger.info('✅ All browser cache cleared')
    } catch (error) {
      logger.error('❌ Failed to clear all cache:', error)
    }
  },

  /**
   * Enable debug logging for all Studio components
   */
  enableDebugLogging(): void {
    try {
      localStorage.setItem('trokky_debug_enabled', 'true')
      // Set logger level to debug if supported
      if ((window as any).TrokkyLogger?.setLevel) {
        (window as any).TrokkyLogger.setLevel('debug')
      }
      logger.info('✅ Debug logging enabled')
    } catch (error) {
      logger.error('❌ Failed to enable debug logging:', error)
    }
  },

  /**
   * Disable debug logging
   */
  disableDebugLogging(): void {
    try {
      localStorage.removeItem('trokky_debug_enabled')
      // Reset logger level if supported
      if ((window as any).TrokkyLogger?.setLevel) {
        (window as any).TrokkyLogger.setLevel('info')
      }
      logger.info('✅ Debug logging disabled')
    } catch (error) {
      logger.error('❌ Failed to disable debug logging:', error)
    }
  }
}

/**
 * Expose debug utilities to window for console access
 */
if (typeof window !== 'undefined') {
  (window as any).TrokkyDebug = TrokkyDebug
  
  // Development mode helpers
  if (process.env.NODE_ENV === 'development') {
    logger.info('🔧 Debug utilities available at window.TrokkyDebug')
    logger.info('📚 Available methods:', Object.keys(TrokkyDebug))
  }
}

export default TrokkyDebug