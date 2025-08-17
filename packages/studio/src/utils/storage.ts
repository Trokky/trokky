/**
 * Centralized storage utility for Trokky Studio
 * Provides type-safe localStorage operations with consistent key naming
 */

import { createStudioLogger } from './logger';

const logger = createStudioLogger('Storage');

// Known storage keys with their prefixes
export const STORAGE_KEYS = {
  // Auth related
  AUTH_TOKEN: 'trokky_auth_token',
  REFRESH_TOKEN: 'trokky_refresh_token',
  USER_DATA: 'trokky_user_data',
  
  // UI preferences
  THEME: 'trokky_theme',
  SIDEBAR_COLLAPSED: 'trokky_sidebar_collapsed',
  SIDEBAR_WIDTH: 'trokky_sidebar_width',
  
  // Content views (dynamic keys)
  CONTENT_VIEW: (schemaName: string) => `trokky_view_${schemaName}`,
  COLUMN_VISIBILITY: (schemaName: string) => `trokky_columns_${schemaName}`,
  GRID_SETTINGS: (schemaName: string) => `trokky_grid_${schemaName}`,
  TABLE_SETTINGS: (schemaName: string) => `trokky_table_${schemaName}`,
  
  // App state
  STUDIO_CONFIG: 'trokky_studio_config',
  STRUCTURE_CACHE: 'trokky_structure_cache',
  DEBUG_ENABLED: 'trokky_debug_enabled',
  BACKEND_URL: 'trokky_backend_url',
  
  // Media
  MEDIA_VIEW_MODE: 'trokky_media_view_mode',
  
  // Context (page-specific)
  CONTEXT_SIDEBAR_VISIBLE: (page: string) => `trokky_context_sidebar_${page}_visible`,
  CONTEXT_SIDEBAR_COLLAPSED: (page: string) => `trokky_context_sidebar_${page}_collapsed`,
  CONTEXT_SIDEBAR_WIDTH: (page: string) => `trokky_context_sidebar_${page}_width`,
  CONTEXT_SIDEBAR_POSITION: (page: string) => `trokky_context_sidebar_${page}_position`,
  
  // Documents
  DOCUMENT_SIDEBAR_COLLAPSED: 'trokky_document_sidebar_collapsed',
  RECENT_SEARCHES: 'trokky_recent_searches'
} as const;

export interface StorageService {
  get<T = any>(key: string, defaultValue?: T): T | null;
  set<T = any>(key: string, value: T): boolean;
  remove(key: string): boolean;
  exists(key: string): boolean;
  clear(pattern?: string): boolean;
  getAllKeys(): string[];
}

/**
 * Safe localStorage wrapper with error handling and logging
 */
class BrowserStorageService implements StorageService {
  private isAvailable(): boolean {
    try {
      return typeof localStorage !== 'undefined' && localStorage !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get value from localStorage with optional default
   */
  get<T = any>(key: string, defaultValue?: T): T | null {
    if (!this.isAvailable()) {
      logger.warn('localStorage not available, returning default value');
      return defaultValue ?? null;
    }

    try {
      const value = localStorage.getItem(key);
      if (value === null) {
        return defaultValue ?? null;
      }

      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      logger.error('Failed to get item from localStorage', { key, error });
      return defaultValue ?? null;
    }
  }

  /**
   * Set value in localStorage
   */
  set<T = any>(key: string, value: T): boolean {
    if (!this.isAvailable()) {
      logger.warn('localStorage not available, cannot set value');
      return false;
    }

    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      logger.error('Failed to set item in localStorage', { key, error });
      return false;
    }
  }

  /**
   * Remove item from localStorage
   */
  remove(key: string): boolean {
    if (!this.isAvailable()) {
      logger.warn('localStorage not available, cannot remove value');
      return false;
    }

    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      logger.error('Failed to remove item from localStorage', { key, error });
      return false;
    }
  }

  /**
   * Check if key exists in localStorage
   */
  exists(key: string): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      return localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Clear localStorage items, optionally by pattern
   */
  clear(pattern?: string): boolean {
    if (!this.isAvailable()) {
      logger.warn('localStorage not available, cannot clear values');
      return false;
    }

    try {
      if (pattern) {
        // Clear items matching pattern
        const keys = this.getAllKeys().filter(key => key.includes(pattern));
        keys.forEach(key => localStorage.removeItem(key));
        logger.info(`Cleared ${keys.length} items matching pattern: ${pattern}`);
      } else {
        // Clear all trokky items
        const trokkyKeys = this.getAllKeys().filter(key => key.startsWith('trokky_'));
        trokkyKeys.forEach(key => localStorage.removeItem(key));
        logger.info(`Cleared ${trokkyKeys.length} trokky items`);
      }
      return true;
    } catch (error) {
      logger.error('Failed to clear localStorage', { pattern, error });
      return false;
    }
  }

  /**
   * Get all localStorage keys
   */
  getAllKeys(): string[] {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      return Object.keys(localStorage);
    } catch {
      return [];
    }
  }
}

// Create singleton instance
export const storageService: StorageService = new BrowserStorageService();

// Convenience methods for common operations
export const storage = {
  // View preferences
  getContentView: (schemaName: string, defaultView = 'list') => 
    storageService.get(STORAGE_KEYS.CONTENT_VIEW(schemaName), defaultView),
  
  setContentView: (schemaName: string, view: string) => 
    storageService.set(STORAGE_KEYS.CONTENT_VIEW(schemaName), view),
  
  // Column visibility
  getColumnVisibility: (schemaName: string, defaultColumns: Record<string, boolean> = {}) => 
    storageService.get(STORAGE_KEYS.COLUMN_VISIBILITY(schemaName), defaultColumns),
  
  setColumnVisibility: (schemaName: string, visibility: Record<string, boolean>) => 
    storageService.set(STORAGE_KEYS.COLUMN_VISIBILITY(schemaName), visibility),
  
  // Grid settings
  getGridSettings: (schemaName: string, defaults = { cardSize: 'medium', columnsPerRow: null }) => 
    storageService.get(STORAGE_KEYS.GRID_SETTINGS(schemaName), defaults),
  
  setGridSettings: (schemaName: string, settings: any) => 
    storageService.set(STORAGE_KEYS.GRID_SETTINGS(schemaName), settings),
  
  // Table settings
  getTableSettings: (schemaName: string, defaults = { density: 'comfortable', columnWidths: {} }) => 
    storageService.get(STORAGE_KEYS.TABLE_SETTINGS(schemaName), defaults),
  
  setTableSettings: (schemaName: string, settings: any) => 
    storageService.set(STORAGE_KEYS.TABLE_SETTINGS(schemaName), settings),
  
  // UI preferences
  getTheme: () => storageService.get(STORAGE_KEYS.THEME, 'light'),
  setTheme: (theme: string) => storageService.set(STORAGE_KEYS.THEME, theme),
  
  getSidebarCollapsed: () => storageService.get(STORAGE_KEYS.SIDEBAR_COLLAPSED, false),
  setSidebarCollapsed: (collapsed: boolean) => storageService.set(STORAGE_KEYS.SIDEBAR_COLLAPSED, collapsed),
  
  getSidebarWidth: () => storageService.get(STORAGE_KEYS.SIDEBAR_WIDTH, 280),
  setSidebarWidth: (width: number) => storageService.set(STORAGE_KEYS.SIDEBAR_WIDTH, width),
  
  // Cleanup
  clearAll: () => storageService.clear(),
  clearSchema: (schemaName: string) => storageService.clear(schemaName),
  
  // Direct access to service
  service: storageService
};

export default storage;