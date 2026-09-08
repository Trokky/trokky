import type { ApiResponse, Document, QueryOptions, Schema, SearchResponse } from '@/types'

/**
 * The slice of the API client the fallback needs. Declared here so the search
 * fallback does not depend on the whole client.
 */
export interface SearchSource {
  getSchemas(): Promise<ApiResponse<Schema[]>>
  getDocuments(
    schemaName: string,
    options?: QueryOptions
  ): Promise<ApiResponse<{ documents: Document[]; total: number }>>
}

/**
 * Client-side search fallback
 */
export async function clientSideSearch(
  source: SearchSource,
  query: string,
  options: { types?: string[]; limit?: number } = {}
): Promise<ApiResponse<SearchResponse>> {
  // Basic client-side search implementation
  const results: any[] = []

  // Search documents if enabled
  if (!options.types || options.types.includes('documents')) {
    try {
      const schemas = await source.getSchemas()
      if (schemas.success && schemas.data) {
        for (const schema of schemas.data.slice(0, 3)) {
          const docs = await source.getDocuments(schema.name, {
            limit: 5,
            search: query,
          })
          if (docs.success && docs.data?.documents) {
            results.push(
              ...docs.data.documents.map((doc: any) => ({
                id: doc.id || doc._id,
                type: 'document',
                title: doc.title || doc.name || doc.id || doc._id,
                url: `/content/${schema.name}/${doc.id || doc._id}`,
                metadata: {
                  status: doc._status,
                  createdAt: doc._createdAt,
                },
              }))
            )
          }
        }
      }
    } catch (error) {
      console.warn('Document search failed:', error)
    }
  }

  return {
    success: true,
    data: {
      results: results.slice(0, options.limit || 20),
      totalCount: results.length,
      categories: {
        documents: results.filter(r => r.type === 'document').length,
        media: 0,
        users: 0,
        schemas: 0,
      },
      query,
      searchTime: 0,
    },
  }
}
