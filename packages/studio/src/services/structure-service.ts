/**
 * Structure Service - Manages structure state and provides navigation data
 */

import { StructureBuilder } from './structure-builder'
import type { ApiClient } from './api-client'
import type { 
  StudioStructure, 
  NavigationTree, 
  StructureGenerationOptions 
} from '../types/structure'

export class StructureService {
  private client: ApiClient
  private builder: StructureBuilder
  private cachedStructure: StudioStructure | null = null
  private cachedNavigation: NavigationTree | null = null

  constructor(client: ApiClient) {
    this.client = client
    this.builder = new StructureBuilder(client)
  }

  /**
   * Get the current structure, generating it if necessary
   */
  async getStructure(options?: StructureGenerationOptions): Promise<StudioStructure> {
    if (!this.cachedStructure) {
      // Priority 1: Try to fetch dynamic structure from API endpoint
      try {
        const response = await this.client.get('/api/config/structure')
        if (response.success && response.data) {
          this.cachedStructure = (response.data as any).structure
          console.debug('[StructureService] Loaded dynamic structure from endpoint', {
            title: this.cachedStructure?.title,
            itemsCount: this.cachedStructure?.items?.length || 0
          })
          return this.cachedStructure!
        }
      } catch (error) {
        console.warn('[StructureService] Failed to fetch dynamic structure from endpoint, falling back to static', error)
      }
      
      // Priority 2: Check for static Studio configuration structure
      const config = (window as any).TROKKY_CONFIG
      if (config?.structure && typeof config.structure === 'object') {
        this.cachedStructure = config.structure
        console.debug('[StructureService] Using static structure from config')
      } else {
        // Priority 3: Auto-generate structure from schemas
        this.cachedStructure = await this.builder.generateFromSchemas(options)
        console.debug('[StructureService] Generated structure from schemas')
      }
    }
    return this.cachedStructure!
  }

  /**
   * Get navigation tree for current structure
   */
  async getNavigation(currentPath?: string, options?: StructureGenerationOptions): Promise<NavigationTree> {
    const structure = await this.getStructure(options)
    
    // Rebuild navigation if path changed or no cache
    if (!this.cachedNavigation || currentPath) {
      this.cachedNavigation = this.builder.buildNavigation(structure, currentPath)
    }
    
    return this.cachedNavigation
  }

  /**
   * Set custom structure (overrides auto-generation)
   */
  setStructure(structure: StudioStructure): void {
    const validation = this.builder.validate(structure)
    if (!validation.isValid) {
      throw new Error(`Invalid structure: ${validation.errors.join(', ')}`)
    }
    
    this.cachedStructure = structure
    this.cachedNavigation = null // Clear navigation cache
  }

  /**
   * Clear cached structure and navigation (forces regeneration)
   */
  clearCache(): void {
    this.cachedStructure = null
    this.cachedNavigation = null
    console.debug('[StructureService] Cache cleared, next request will fetch fresh structure')
  }

  /**
   * Refresh structure from endpoint (bypasses cache)
   */
  async refreshFromEndpoint(): Promise<StudioStructure | null> {
    try {
      const response = await this.client.get('/api/config/structure', { 
        // Add cache-busting parameter
        _refresh: Date.now() 
      })
      
      if (response.success && response.data) {
        this.cachedStructure = (response.data as any).structure
        this.cachedNavigation = null // Clear navigation cache too
        
        console.debug('[StructureService] Refreshed structure from endpoint', {
          title: this.cachedStructure!.title,
          itemsCount: this.cachedStructure!.items?.length || 0
        })
        
        return this.cachedStructure!
      }
      
      return null
    } catch (error) {
      console.error('[StructureService] Failed to refresh structure from endpoint', error)
      return null
    }
  }

  /**
   * Check if structure is cached
   */
  isCached(): boolean {
    return this.cachedStructure !== null
  }

  /**
   * Get structure item by schema type
   */
  async getStructureItemBySchema(schemaType: string): Promise<any> {
    const structure = await this.getStructure()
    
    const findItem = (items: any[]): any => {
      for (const item of items) {
        if (item.type === 'documentList' || item.type === 'singleton') {
          if (item.schemaType === schemaType) {
            return item
          }
        } else if (item.type === 'group' && item.items) {
          const found = findItem(item.items)
          if (found) return found
        }
      }
      return null
    }
    
    return findItem(structure.items)
  }

  /**
   * Get all document list items from structure
   */
  async getDocumentListItems(): Promise<any[]> {
    const structure = await this.getStructure()
    
    const collectItems = (items: any[]): any[] => {
      const result: any[] = []
      for (const item of items) {
        if (item.type === 'documentList') {
          result.push(item)
        } else if (item.type === 'group' && item.items) {
          result.push(...collectItems(item.items))
        }
      }
      return result
    }
    
    return collectItems(structure.items)
  }

  /**
   * Get all singleton items from structure
   */
  async getSingletonItems(): Promise<any[]> {
    const structure = await this.getStructure()
    
    const collectItems = (items: any[]): any[] => {
      const result: any[] = []
      for (const item of items) {
        if (item.type === 'singleton') {
          result.push(item)
        } else if (item.type === 'group' && item.items) {
          result.push(...collectItems(item.items))
        }
      }
      return result
    }
    
    return collectItems(structure.items)
  }

  /**
   * Validate current structure
   */
  async validateStructure(): Promise<{ isValid: boolean; errors: string[] }> {
    const structure = await this.getStructure()
    return this.builder.validate(structure)
  }
}

// Create a singleton instance
let structureServiceInstance: StructureService | null = null

export function createStructureService(client: ApiClient): StructureService {
  if (!structureServiceInstance) {
    structureServiceInstance = new StructureService(client)
  }
  return structureServiceInstance
}

export function getStructureService(): StructureService {
  if (!structureServiceInstance) {
    throw new Error('Structure service not initialized. Call createStructureService first.')
  }
  return structureServiceInstance
}