/**
 * Structure Hooks - React hooks for structure and navigation
 */

import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useApiClient } from './useApiClient'
import { createStructureService } from '../services/structure-service'
import type { 
  StudioStructure, 
  NavigationTree, 
  StructureGenerationOptions 
} from '../types/structure'

/**
 * Hook for managing structure state
 */
export function useStructure(options?: StructureGenerationOptions) {
  const client = useApiClient()
  const [structure, setStructure] = useState<StudioStructure | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const structureService = createStructureService(client)

  const loadStructure = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const loadedStructure = await structureService.getStructure(options)
      setStructure(loadedStructure)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load structure')
      console.error('Failed to load structure:', err)
    } finally {
      setLoading(false)
    }
  }, [structureService, options])

  const refreshStructure = useCallback(() => {
    structureService.clearCache()
    loadStructure()
  }, [structureService, loadStructure])

  const setCustomStructure = useCallback((customStructure: StudioStructure) => {
    try {
      structureService.setStructure(customStructure)
      setStructure(customStructure)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid structure')
    }
  }, [structureService])

  useEffect(() => {
    loadStructure()
  }, [loadStructure])

  return {
    structure,
    loading,
    error,
    refreshStructure,
    setCustomStructure,
    isReady: !loading && !error && structure !== null
  }
}

/**
 * Hook for navigation tree with current route awareness
 */
export function useNavigation(options?: StructureGenerationOptions) {
  const location = useLocation()
  const client = useApiClient()
  const [navigation, setNavigation] = useState<NavigationTree | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const structureService = createStructureService(client)

  const loadNavigation = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const navTree = await structureService.getNavigation(location.pathname, options)
      setNavigation(navTree)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load navigation')
      console.error('Failed to load navigation:', err)
    } finally {
      setLoading(false)
    }
  }, [structureService, location.pathname, options])

  const refreshNavigation = useCallback(() => {
    structureService.clearCache()
    loadNavigation()
  }, [structureService, loadNavigation])

  useEffect(() => {
    loadNavigation()
  }, [loadNavigation])

  return {
    navigation,
    loading,
    error,
    refreshNavigation,
    currentPath: location.pathname,
    isReady: !loading && !error && navigation !== null
  }
}

/**
 * Hook for getting structure item by schema type
 */
export function useStructureItem(schemaType: string) {
  const client = useApiClient()
  const [item, setItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const structureService = createStructureService(client)

  useEffect(() => {
    async function loadItem() {
      try {
        setLoading(true)
        setError(null)
        const structureItem = await structureService.getStructureItemBySchema(schemaType)
        setItem(structureItem)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load structure item')
        console.error('Failed to load structure item:', err)
      } finally {
        setLoading(false)
      }
    }

    if (schemaType) {
      loadItem()
    }
  }, [structureService, schemaType])

  return {
    item,
    loading,
    error,
    isReady: !loading && !error
  }
}

/**
 * Hook for getting all document types from structure
 */
export function useDocumentTypes() {
  const client = useApiClient()
  const [documentTypes, setDocumentTypes] = useState<any[]>([])
  const [singletonTypes, setSingletonTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const structureService = createStructureService(client)

  useEffect(() => {
    async function loadTypes() {
      try {
        setLoading(true)
        setError(null)
        
        const [docItems, singletonItems] = await Promise.all([
          structureService.getDocumentListItems(),
          structureService.getSingletonItems()
        ])
        
        setDocumentTypes(docItems)
        setSingletonTypes(singletonItems)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document types')
        console.error('Failed to load document types:', err)
      } finally {
        setLoading(false)
      }
    }

    loadTypes()
  }, [structureService])

  return {
    documentTypes,
    singletonTypes,
    allTypes: [...documentTypes, ...singletonTypes],
    loading,
    error,
    isReady: !loading && !error
  }
}