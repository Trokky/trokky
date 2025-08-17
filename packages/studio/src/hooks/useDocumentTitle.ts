/**
 * Hook for dynamically updating the document title based on settings
 */

import { useEffect } from 'react'
import { apiClient } from '@/services/api-client'
import { createStudioLogger } from '@/utils/logger'

const logger = createStudioLogger('useDocumentTitle')

export function useDocumentTitle(isAuthenticated: boolean = false) {
  const updateDocumentTitle = async () => {
      // Only make API calls if authenticated
      if (isAuthenticated) {
        try {
          // Try to get settings from API
          const response = await apiClient.get('/config/settings')
          
          if (response.success && response.data?.settings?.studioTitle) {
            const title = response.data.settings.studioTitle
            document.title = title
            logger.debug('Document title updated from settings', { title })
            return
          }
        } catch (error) {
          logger.warn('Failed to load settings for document title', error)
        }

        // Fallback to config or default
        try {
          const configResponse = await apiClient.get('/config/studio')
          if (configResponse.success && configResponse.data?.studioConfig?.branding?.title) {
            const title = configResponse.data.studioConfig.branding.title
            document.title = title
            logger.debug('Document title updated from studio config', { title })
            return
          }
        } catch (error) {
          logger.warn('Failed to load studio config for document title', error)
        }
      }

      // Fallback to window config or default (works for both authenticated and unauthenticated)
      const windowConfig = (window as any).TROKKY_CONFIG
      const fallbackTitle = windowConfig?.branding?.title || 'Trokky Studio'
      document.title = fallbackTitle
      logger.debug('Document title updated from fallback', { title: fallbackTitle })
    }

  useEffect(() => {
    // Initial title update
    updateDocumentTitle()

    // Listen for settings changes to update title
    const handleSettingsChanged = () => {
      logger.debug('Settings changed, updating document title')
      updateDocumentTitle()
    }

    // Custom event listener for settings changes
    window.addEventListener('trokky:settings:updated', handleSettingsChanged)

    return () => {
      window.removeEventListener('trokky:settings:updated', handleSettingsChanged)
    }
  }, [isAuthenticated])
}