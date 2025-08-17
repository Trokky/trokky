/**
 * Hook for managing current user data with real-time updates
 */

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/services/api-client'
import { createStudioLogger } from '@/utils/logger'
import type { User } from '@/types'

const logger = createStudioLogger('useCurrentUser')

interface UseCurrentUserReturn {
  user: User | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  updateUser: (userData: Partial<User>) => void
}

export function useCurrentUser(): UseCurrentUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCurrentUser = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      logger.debug('Fetching current user data')
      
      const response = await apiClient.getCurrentUser()
      
      if (response.success && response.data) {
        setUser(response.data)
        logger.debug('Current user data loaded', { username: response.data.username })
      } else {
        throw new Error(response.error?.message || 'Failed to fetch user data')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user data'
      logger.error('Failed to fetch current user', err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  // Update user data locally and emit event
  const updateUser = useCallback((userData: Partial<User>) => {
    setUser(prevUser => {
      if (!prevUser) return null
      
      const updatedUser = { ...prevUser, ...userData }
      
      // Emit custom event for other components to react to user changes
      window.dispatchEvent(new CustomEvent('trokky:user:updated', {
        detail: { user: updatedUser }
      }))
      
      logger.debug('User data updated locally', { userData })
      return updatedUser
    })
  }, [])

  // Listen for user update events from other components
  useEffect(() => {
    const handleUserUpdated = (event: CustomEvent) => {
      const { user: updatedUser } = event.detail
      logger.debug('Received user update event', { user: updatedUser })
      setUser(updatedUser)
    }

    // Listen for user update events
    window.addEventListener('trokky:user:updated', handleUserUpdated as EventListener)

    return () => {
      window.removeEventListener('trokky:user:updated', handleUserUpdated as EventListener)
    }
  }, [])

  // Initial fetch on mount
  useEffect(() => {
    fetchCurrentUser()
  }, [fetchCurrentUser])

  return {
    user,
    loading,
    error,
    refetch: fetchCurrentUser,
    updateUser
  }
}