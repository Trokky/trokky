import { 
  StorageAdapter, 
  Document, 
  DocumentData, 
  ListOptions, 
  MediaFile, 
  MediaMetadata,
  Migration
} from '../../types/index'

export class MemoryStorageAdapter implements StorageAdapter {
  private documents = new Map<string, Map<string, Document>>()
  private media = new Map<string, MediaFile>()
  private isHealthy = true

  // Document operations
  async getDocument(collection: string, id: string): Promise<Document | null> {
    const collectionData = this.documents.get(collection)
    return collectionData?.get(id) || null
  }

  async saveDocument(collection: string, id: string, data: DocumentData): Promise<Document> {
    if (!this.documents.has(collection)) {
      this.documents.set(collection, new Map())
    }

    const collectionData = this.documents.get(collection)!
    const existingDoc = collectionData.get(id)
    
    const document: Document = {
      id,
      ...data,
      _collection: collection,
      _createdAt: existingDoc?._createdAt || new Date(),
      _updatedAt: new Date(),
      _revision: (existingDoc?._revision || 0) + 1
    }

    collectionData.set(id, document)
    return document
  }

  async listDocuments(collection: string, options?: ListOptions): Promise<Document[]> {
    const collectionData = this.documents.get(collection)
    if (!collectionData) return []

    let documents = Array.from(collectionData.values())

    // Apply filtering
    if (options?.filter) {
      documents = documents.filter(doc => this.matchesFilter(doc, options.filter!))
    }

    // Apply sorting
    if (options?.sort) {
      const sortFields = Array.isArray(options.sort) ? options.sort : [options.sort]
      documents = this.sortDocuments(documents, sortFields)
    }

    // Apply pagination
    const offset = options?.offset || 0
    const limit = options?.limit || documents.length
    
    return documents.slice(offset, offset + limit)
  }

  async deleteDocument(collection: string, id: string): Promise<void> {
    const collectionData = this.documents.get(collection)
    if (collectionData) {
      collectionData.delete(id)
    }
  }

  // Media operations
  async uploadFile(file: File, metadata: MediaMetadata): Promise<MediaFile> {
    const mediaFile: MediaFile = {
      id: metadata.id,
      url: `memory://media/${metadata.id}.${metadata.extension}`,
      filename: metadata.filename,
      contentType: metadata.contentType,
      size: metadata.size,
      _createdAt: new Date()
    }

    this.media.set(metadata.id, mediaFile)
    return mediaFile
  }

  async getFile(id: string): Promise<MediaFile | null> {
    return this.media.get(id) || null
  }

  async deleteFile(id: string): Promise<void> {
    this.media.delete(id)
  }

  // Utility operations
  async healthCheck(): Promise<boolean> {
    return this.isHealthy
  }

  async migrate(migrations: Migration[]): Promise<void> {
    // Memory adapter doesn't need migrations
    return Promise.resolve()
  }

  // Test helpers
  setHealthy(healthy: boolean): void {
    this.isHealthy = healthy
  }

  clear(): void {
    this.documents.clear()
    this.media.clear()
  }

  getDocumentCount(collection?: string): number {
    if (collection) {
      return this.documents.get(collection)?.size || 0
    }
    
    let total = 0
    for (const collectionData of this.documents.values()) {
      total += collectionData.size
    }
    return total
  }

  getMediaCount(): number {
    return this.media.size
  }

  private matchesFilter(document: Document, filter: Record<string, unknown>): boolean {
    for (const [field, value] of Object.entries(filter)) {
      const docValue = (document as any)[field]
      
      if (typeof value === 'object' && value !== null) {
        // Handle comparison operators
        for (const [op, compareValue] of Object.entries(value as Record<string, unknown>)) {
          switch (op) {
            case '$eq':
              if (docValue !== compareValue) return false
              break
            case '$ne':
              if (docValue === compareValue) return false
              break
            case '$gt':
              if (typeof docValue !== 'number' || typeof compareValue !== 'number' || docValue <= compareValue) return false
              break
            case '$gte':
              if (typeof docValue !== 'number' || typeof compareValue !== 'number' || docValue < compareValue) return false
              break
            case '$lt':
              if (typeof docValue !== 'number' || typeof compareValue !== 'number' || docValue >= compareValue) return false
              break
            case '$lte':
              if (typeof docValue !== 'number' || typeof compareValue !== 'number' || docValue > compareValue) return false
              break
            case '$in':
              if (!Array.isArray(compareValue) || !compareValue.includes(docValue)) return false
              break
            case '$nin':
              if (!Array.isArray(compareValue) || compareValue.includes(docValue)) return false
              break
          }
        }
      } else {
        // Direct value comparison
        if (docValue !== value) return false
      }
    }
    
    return true
  }

  private sortDocuments(documents: Document[], sortFields: string[]): Document[] {
    return documents.sort((a, b) => {
      for (const sortField of sortFields) {
        const [field, direction = 'asc'] = sortField.split('.')
        const aValue = (a as any)[field]
        const bValue = (b as any)[field]
        
        let comparison = 0
        if (aValue < bValue) comparison = -1
        else if (aValue > bValue) comparison = 1
        
        if (direction === 'desc') comparison *= -1
        
        if (comparison !== 0) return comparison
      }
      
      return 0
    })
  }
}