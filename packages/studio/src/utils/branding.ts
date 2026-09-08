/**
 * Branding utility functions for Trokky Studio
 */

import { apiClient } from '@/services/api-client';

export interface BrandingConfig {
  title?: string;
  organizationName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logo?: string;
}

/**
 * Convert hex color to RGB format for CSS variables
 */
export function hexToRgb(hex: string): string | null {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Parse hex to RGB
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }

  if (hex.length !== 6) {
    return null;
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `${r} ${g} ${b}`;
}

/**
 * Apply brand colors to CSS custom properties
 */
export function applyBrandColors(branding: BrandingConfig): void {
  const root = document.documentElement;

  // Apply primary color
  if (branding.primaryColor) {
    const primaryRgb = hexToRgb(branding.primaryColor);
    if (primaryRgb) {
      root.style.setProperty('--color-primary-500', primaryRgb);
      root.style.setProperty('--color-primary-600', primaryRgb);
      root.style.setProperty('--color-primary-700', primaryRgb);
    }
  }

  // Apply secondary color
  if (branding.secondaryColor) {
    const secondaryRgb = hexToRgb(branding.secondaryColor);
    if (secondaryRgb) {
      root.style.setProperty('--color-secondary-500', secondaryRgb);
      root.style.setProperty('--color-secondary-600', secondaryRgb);
      root.style.setProperty('--color-secondary-700', secondaryRgb);
    }
  }
}

/**
 * Fetch branding configuration from API
 */
export async function fetchBranding(): Promise<BrandingConfig> {
  try {
    const response = await apiClient.get<{ studioConfig?: { branding?: BrandingConfig } }>('/config/studio');
    if (response.success && response.data?.studioConfig?.branding) {
      return response.data.studioConfig.branding;
    }
  } catch (error) {
    console.error('Failed to fetch branding:', error);
  }

  // Fallback to window config
  const config = (window as any).TROKKY_CONFIG;
  return config?.branding || { title: 'Trokky Studio' };
}
