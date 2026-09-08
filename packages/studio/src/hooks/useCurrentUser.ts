/**
 * Hook for the signed-in user.
 *
 * Backed by react-query so the fourteen components that need the current user
 * share one `/auth/me` request per page load instead of each firing its own.
 */

import { useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/services/api-client'
import { createStudioLogger } from '@/utils/logger'
import type { User } from '@/types'

const logger = createStudioLogger('useCurrentUser')

/** Query key for the signed-in user. Exported so sign-out can evict it. */
export const CURRENT_USER_QUERY_KEY = ['auth', 'me'] as const

interface UseCurrentUserReturn {
  user: User | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  updateUser: (userData: Partial<User>) => void
}

export async function fetchCurrentUser(): Promise<User> {
  const response = await apiClient.getCurrentUser()

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to fetch user data')
  }

  logger.debug('Current user data loaded', { username: response.data.username })
  return response.data
}

export function useCurrentUser(): UseCurrentUserReturn {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: fetchCurrentUser,
  })

  // Update user data locally and tell the rest of the app
  const updateUser = useCallback(
    (userData: Partial<User>) => {
      const current = queryClient.getQueryData<User>(CURRENT_USER_QUERY_KEY)
      if (!current) return

      const updatedUser = { ...current, ...userData }
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, updatedUser)

      window.dispatchEvent(
        new CustomEvent('trokky:user:updated', {
          detail: { user: updatedUser },
        })
      )

      logger.debug('User data updated locally', { userData })
    },
    [queryClient]
  )

  // Components that edit the user outside this hook still announce it by event
  useEffect(() => {
    const handleUserUpdated = (event: Event): void => {
      const { user: updatedUser } = (event as CustomEvent).detail
      logger.debug('Received user update event', { user: updatedUser })
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, updatedUser)
    }

    window.addEventListener('trokky:user:updated', handleUserUpdated)

    return () => {
      window.removeEventListener('trokky:user:updated', handleUserUpdated)
    }
  }, [queryClient])

  const refetch = useCallback(async () => {
    await query.refetch()
  }, [query])

  return {
    user: query.data ?? null,
    loading: query.isPending,
    error: query.error ? (query.error as Error).message : null,
    refetch,
    updateUser,
  }
}
