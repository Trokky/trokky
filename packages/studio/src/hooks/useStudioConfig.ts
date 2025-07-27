/**
 * React hook for accessing Studio configuration from API
 */

import { useState, useEffect } from 'react'
import { useApiClient } from './useApiClient'
import { getStudioConfigService, type StudioBranding, type StudioConfigData } from '../services/config-service'

export function useStudioConfig() {
  const apiClient = useApiClient()
  const [config, setConfig] = useState<StudioConfigData | null>(null)
  const [branding, setBranding] = useState<StudioBranding>({
    title: 'Trokky Studio'
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configService = getStudioConfigService(apiClient)
        const [configData, brandingData] = await Promise.all([
          configService.fetchAndMergeConfig(),
          configService.getBranding()
        ])
        
        setConfig(configData)
        setBranding(brandingData)
      } catch (error) {
        console.warn('[useStudioConfig] Failed to fetch config:', error)
        // Use fallback from window
        const windowConfig = (window as any).TROKKY_CONFIG
        setBranding(windowConfig?.branding || { title: 'Trokky Studio' })
      } finally {
        setLoading(false)
      }
    }

    fetchConfig()
  }, [apiClient])

  return {
    config,
    branding,
    loading
  }
}

/**
 * Hook specifically for branding information
 */
export function useStudioBranding() {
  const { branding, loading } = useStudioConfig()
  return { branding, loading }
}