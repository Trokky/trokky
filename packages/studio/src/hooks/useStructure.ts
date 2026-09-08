/**
 * Structure Hooks - React hooks for structure and navigation
 *
 * All four hooks read through react-query against one key family, so the
 * structure is fetched once and every consumer shares that copy instead of each
 * keeping its own useState mirror of the structure service's cache.
 */

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { apiClient } from '../services/api-client'
import { createStructureService } from '../services/structure-service'
import type {
  StudioStructure,
  NavigationTree,
  StructureGenerationOptions,
} from '../types/structure'

/** Root of the structure key family; everything below it invalidates together. */
export const STRUCTURE_QUERY_KEY = ['structure'] as const

function structureService() {
  return createStructureService(apiClient)
}

/**
 * Hook for managing structure state
 */
export function useStructure(options?: StructureGenerationOptions) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: [...STRUCTURE_QUERY_KEY, 'root', options ?? null],
    queryFn: () => structureService().getStructure(options),
  })

  const refreshStructure = useCallback(() => {
    structureService().clearCache()
    queryClient.invalidateQueries({ queryKey: STRUCTURE_QUERY_KEY })
  }, [queryClient])

  const setCustomStructure = useCallback(
    (customStructure: StudioStructure) => {
      structureService().setStructure(customStructure)
      queryClient.invalidateQueries({ queryKey: STRUCTURE_QUERY_KEY })
    },
    [queryClient]
  )

  const structure = query.data ?? null
  const error = query.error ? (query.error as Error).message : null

  return {
    structure,
    loading: query.isPending,
    error,
    refreshStructure,
    setCustomStructure,
    isReady: !query.isPending && !error && structure !== null,
  }
}

/**
 * Hook for navigation tree with current route awareness
 */
export function useNavigation(options?: StructureGenerationOptions) {
  const location = useLocation()
  const queryClient = useQueryClient()

  const query = useQuery<NavigationTree>({
    queryKey: [
      ...STRUCTURE_QUERY_KEY,
      'navigation',
      location.pathname,
      options ?? null,
    ],
    queryFn: () => structureService().getNavigation(location.pathname, options),
  })

  const refreshNavigation = useCallback(() => {
    structureService().clearCache()
    queryClient.invalidateQueries({ queryKey: STRUCTURE_QUERY_KEY })
  }, [queryClient])

  const navigation = query.data ?? null
  const error = query.error ? (query.error as Error).message : null

  return {
    navigation,
    loading: query.isPending,
    error,
    refreshNavigation,
    currentPath: location.pathname,
    isReady: !query.isPending && !error && navigation !== null,
  }
}

/**
 * Hook for getting structure item by schema type
 */
export function useStructureItem(schemaType: string) {
  const query = useQuery({
    queryKey: [...STRUCTURE_QUERY_KEY, 'item', schemaType],
    queryFn: () => structureService().getStructureItemBySchema(schemaType),
    enabled: !!schemaType,
  })

  const error = query.error ? (query.error as Error).message : null
  // A disabled query never resolves, so an empty schemaType must not read as
  // permanently loading the way `isPending` alone would.
  const loading = !!schemaType && query.isPending

  return {
    item: query.data ?? null,
    loading,
    error,
    isReady: !loading && !error,
  }
}

/**
 * Hook for getting all document types from structure
 */
export function useDocumentTypes() {
  const query = useQuery({
    queryKey: [...STRUCTURE_QUERY_KEY, 'documentTypes'],
    queryFn: async () => {
      const service = structureService()
      const [documentTypes, singletonTypes] = await Promise.all([
        service.getDocumentListItems(),
        service.getSingletonItems(),
      ])
      return { documentTypes, singletonTypes }
    },
  })

  const documentTypes = query.data?.documentTypes ?? []
  const singletonTypes = query.data?.singletonTypes ?? []
  const error = query.error ? (query.error as Error).message : null

  return {
    documentTypes,
    singletonTypes,
    allTypes: [...documentTypes, ...singletonTypes],
    loading: query.isPending,
    error,
    isReady: !query.isPending && !error,
  }
}
