import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  MemoryEventStorage,
  TrokkyEventBus,
  createDocumentEvent,
  documentCreated,
  documentUpdated,
  documentDeleted,
  createMediaEvent,
  createSystemEvent,
  eventMatches,
  extractDocumentChanges,
  actorFromUser,
  systemActor,
} from '../../core/events/index.js'
import type { Document } from '../../core/types/index.js'

const mockDocument: Document = {
  id: 'doc-1',
  _type: 'article',
  title: 'Test Article',
  body: 'Content here',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const mockActor = { type: 'user' as const, id: 'user-1', name: 'admin' }

describe('Event System', () => {
  describe('Event Builder Functions', () => {
    it('should create document created event', () => {
      const event = documentCreated('article', mockDocument, mockActor)
      expect(event.type).toBe('document.created')
      expect(event.source).toBe('trokky-core')
      expect(event.data.collection).toBe('article')
      expect(event.data.id).toBe('doc-1')
      expect(event.data.document).toBe(mockDocument)
      expect(event.actor).toBe(mockActor)
    })

    it('should create document updated event', () => {
      const updated = { ...mockDocument, title: 'Updated Title' }
      const event = documentUpdated('article', updated, mockDocument, ['title'], mockActor)
      expect(event.type).toBe('document.updated')
      expect(event.data.document).toBe(updated)
      expect(event.data.previousDocument).toBe(mockDocument)
      expect(event.data.changes).toEqual(['title'])
    })

    it('should create document deleted event', () => {
      const event = documentDeleted('article', 'doc-1', mockDocument, mockActor)
      expect(event.type).toBe('document.deleted')
      expect(event.data.id).toBe('doc-1')
      expect(event.data.previousDocument).toBe(mockDocument)
    })

    it('should create event with createDocumentEvent', () => {
      const event = createDocumentEvent(
        'document.created',
        { collection: 'article', id: 'doc-1', document: mockDocument },
        mockActor
      )
      expect(event.type).toBe('document.created')
      expect(event.source).toBe('trokky-core')
    })

    it('should create media event', () => {
      const event = createMediaEvent(
        'media.uploaded',
        { mediaId: 'media-1', filename: 'photo.jpg', mimeType: 'image/jpeg', size: 1024 },
        mockActor
      )
      expect(event.type).toBe('media.uploaded')
    })

    it('should create system event with system actor', () => {
      const event = createSystemEvent('system.startup', { version: '2.0.0' })
      expect(event.type).toBe('system.startup')
      expect(event.actor.type).toBe('system')
      expect(event.source).toBe('system')
    })
  })

  describe('Actor Helpers', () => {
    it('should create actor from user', () => {
      const user = {
        id: 'user-1',
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
      }
      const actor = actorFromUser(user as any)
      expect(actor.id).toBe('user-1')
      expect(actor.type).toBe('user')
      expect(actor.email).toBe('admin@example.com')
    })

    it('should create system actor', () => {
      const actor = systemActor()
      expect(actor.type).toBe('system')
      expect(actor.id).toBe('trokky-core')
      expect(actor.name).toBe('Trokky CMS')
    })
  })

  describe('eventMatches', () => {
    const event = {
      id: 'evt-1',
      type: 'document.created',
      source: 'trokky-core',
      timestamp: new Date().toISOString(),
      actor: systemActor(),
      data: {},
    }

    it('should match exact event type', () => {
      expect(eventMatches(event as any, 'document.created')).toBe(true)
    })

    it('should match wildcard prefix', () => {
      expect(eventMatches(event as any, 'document.*')).toBe(true)
    })

    it('should match global wildcard', () => {
      expect(eventMatches(event as any, '*')).toBe(true)
    })

    it('should not match different event types', () => {
      expect(eventMatches(event as any, 'media.uploaded')).toBe(false)
      expect(eventMatches(event as any, 'document.deleted')).toBe(false)
    })

    it('should not match partial prefix without wildcard', () => {
      expect(eventMatches(event as any, 'document')).toBe(false)
    })
  })

  describe('extractDocumentChanges', () => {
    it('should return all content keys for new documents', () => {
      const changes = extractDocumentChanges(mockDocument)
      expect(changes).toContain('title')
      expect(changes).toContain('body')
      // Should exclude metadata keys starting with _
      expect(changes).not.toContain('_type')
      expect(changes).not.toContain('id')
    })

    it('should detect changed fields between versions', () => {
      const updated = { ...mockDocument, title: 'New Title' }
      const changes = extractDocumentChanges(updated, mockDocument)
      expect(changes).toContain('title')
      expect(changes).not.toContain('body') // unchanged
    })

    it('should return empty array for identical documents', () => {
      const changes = extractDocumentChanges(mockDocument, { ...mockDocument })
      expect(changes).toHaveLength(0)
    })
  })

  describe('TrokkyEventBus', () => {
    let eventBus: TrokkyEventBus

    beforeEach(() => {
      eventBus = new TrokkyEventBus()
    })

    it('should emit events and return event ID', async () => {
      const event = documentCreated('article', mockDocument, systemActor())
      const eventId = await eventBus.emitEvent(event)
      expect(typeof eventId).toBe('string')
      expect(eventId.length).toBeGreaterThan(0)
    })

    it('should store emitted events for querying', async () => {
      await eventBus.emitEvent(documentCreated('article', mockDocument, systemActor()))
      await eventBus.emitEvent(
        documentCreated('article', { ...mockDocument, id: 'doc-2' } as Document, systemActor())
      )

      const events = eventBus.queryEvents()
      expect(events.length).toBeGreaterThanOrEqual(2)
    })

    it('should filter events by type', async () => {
      await eventBus.emitEvent(documentCreated('article', mockDocument, systemActor()))
      await eventBus.emitEvent(
        createMediaEvent('media.uploaded', { mediaId: 'media-1' }, systemActor())
      )

      const docEvents = eventBus.queryEvents({ type: 'document.created' })
      for (const event of docEvents) {
        expect(event.type).toBe('document.created')
      }
    })

    it('should support custom event listeners', async () => {
      let receivedEvent: any = null

      eventBus.addCustomListener({
        id: 'test-listener',
        pattern: 'document.created',
        handler: async (event) => {
          receivedEvent = event
        },
      })

      await eventBus.emitEvent(documentCreated('article', mockDocument, systemActor()))
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(receivedEvent).toBeDefined()
      expect(receivedEvent.type).toBe('document.created')
    })

    it('should remove custom listeners', () => {
      eventBus.addCustomListener({
        id: 'removable',
        pattern: '*',
        handler: async () => {},
      })
      expect(eventBus.removeCustomListener('removable')).toBe(true)
    })

    it('should return false when removing non-existent listener', () => {
      expect(eventBus.removeCustomListener('nonexistent')).toBe(false)
    })

    it('should provide event stats', async () => {
      await eventBus.emitEvent(documentCreated('article', mockDocument, systemActor()))
      const stats = await eventBus.getEventStats()
      expect(stats).toBeDefined()
    })
  })

  describe('MemoryEventStorage teardown', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should stop the cleanup timer firing once closed', async () => {
      const storage = new MemoryEventStorage({ autoCleanup: true, cleanupInterval: 1000, maxAge: 0 })
      const cleanupSpy = vi.spyOn(storage, 'cleanup')

      await vi.advanceTimersByTimeAsync(1000)
      expect(cleanupSpy).toHaveBeenCalledTimes(1)

      await storage.close()

      await vi.advanceTimersByTimeAsync(5000)
      expect(cleanupSpy).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(0)
    })

    it('should be safe to close twice', async () => {
      const storage = new MemoryEventStorage({ autoCleanup: true, cleanupInterval: 1000 })
      await storage.close()
      await expect(storage.close()).resolves.toBeUndefined()
    })

    it('should close its storage when the bus is closed', async () => {
      const storage = new MemoryEventStorage({ autoCleanup: true, cleanupInterval: 1000 })
      const bus = new TrokkyEventBus({ enablePersistence: true, storage })

      await bus.close()

      expect(vi.getTimerCount()).toBe(0)
    })

    it('should not fail when the bus has no storage', async () => {
      const bus = new TrokkyEventBus({ enablePersistence: false })
      await expect(bus.close()).resolves.toBeUndefined()
    })
  })
})
