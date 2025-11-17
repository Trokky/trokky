/**
 * Hook to access Studio branding configuration
 */

import { useStudioContext } from '@/contexts/StudioContext'
import type { BrandingConfig } from '@/utils/branding'

export function useStudioBranding(): BrandingConfig | undefined {
  const studioContext = useStudioContext()
  return studioContext?.branding
}
