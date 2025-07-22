/**
 * API Client Hook - Provides access to the initialized API client
 */

import { apiClient } from '../services/api-client'

/**
 * Hook to get the API client instance
 */
export function useApiClient() {
  return apiClient
}