/**
 * Hook for dynamically updating the document title based on settings
 */

import { useEffect } from 'react'
import { apiClient } from '@/services/api-client'
import { createStudioLogger } from '@/utils/logger'

const logger = createStudioLogger('useDocumentTitle')

export function useDocumentTitle(isAuthenticated: boolean = false) {
  const updateDocumentTitle = async () => {
      // Priority: branding.title (merged from studioTitle > config) > Default
      // Note: branding.title is already merged on backend as:
      //   settings.studioTitle || trokky.config.branding.title || 'Trokky Studio'
      try {
        const configResponse = await apiClient.get<{ studioConfig?: { branding?: { title?: string } } }>('/config/studio')
        if (configResponse.success && configResponse.data?.studioConfig?.branding) {
          const branding = configResponse.data.studioConfig.branding

          // Use branding.title directly (already merged with correct priority on backend)
          if (branding.title) {
            document.title = branding.title
            logger.debug('Document title updated from branding', { title: branding.title })
            return
          }
        }
      } catch (error) {
        logger.warn('Failed to load studio config for document title', error)
      }

      // Default fallback
      document.title = 'Trokky Studio'
      logger.debug('Document title updated from default', { title: 'Trokky Studio' })
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