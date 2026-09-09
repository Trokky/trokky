/**
 * In-Memory Event Storage Implementation
 * 
 * Simple event storage that keeps events in memory. Suitable for development
 * and small-scale deployments. For production, consider a database-backed
 * event storage implementation.
 */

import type {
  EventStorage,
  TrokkyEvent,
  EventFilter,
  EventQueryResult,
  EventStats
} from './types.js'

/**
 * Configuration for memory event storage
 */
export interface MemoryEventStorageConfig {
  /** Maximum number of events to store */
  maxEvents?: number
  /** Whether to automatically clean up old events */
  autoCleanup?: boolean
  /** How often to run cleanup (in milliseconds) */
  cleanupInterval?: number
  /** Maximum age of events before cleanup (in milliseconds) */
  maxAge?: number
}

/**
 * In-memory implementation of EventStorage
 */
export class MemoryEventStorage implements EventStorage {
  private events: TrokkyEvent[] = []
  private config: Required<MemoryEventStorageConfig>
  private cleanupTimer?: NodeJS.Timeout

  constructor(config: MemoryEventStorageConfig = {}) {
    this.config = {
      maxEvents: config.maxEvents || 10000,
      autoCleanup: config.autoCleanup ?? true,
      cleanupInterval: config.cleanupInterval || 60 * 60 * 1000, // 1 hour
      maxAge: config.maxAge || 7 * 24 * 60 * 60 * 1000 // 7 days
    }

    if (this.config.autoCleanup) {
      this.startCleanupTimer()
    }
  }

  async store(event: TrokkyEvent): Promise<void> {
    // Add event to storage
    this.events.push(event)

    // Trim if exceeding max events
    if (this.events.length > this.config.maxEvents) {
      const excess = this.events.length - this.config.maxEvents
      this.events.splice(0, excess)
    }

    // Sort events by timestamp (maintain chronological order)
    this.events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  async query(filter: EventFilter = {}): Promise<EventQueryResult> {
    let filteredEvents = [...this.events]

    // Apply type filter
    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type]
      filteredEvents = filteredEvents.filter(event =>
        types.some(type => this.matchesPattern(event.type, type))
      )
    }

    // Apply actor filter
    if (filter.actor) {
      filteredEvents = filteredEvents.filter(event => event.actor?.id === filter.actor)
    }

    // Apply source filter
    if (filter.source) {
      const sources = Array.isArray(filter.source) ? filter.source : [filter.source]
      filteredEvents = filteredEvents.filter(event => sources.includes(event.source))
    }

    // Apply date range filters
    if (filter.since) {
      filteredEvents = filteredEvents.filter(event => event.timestamp >= filter.since!)
    }

    if (filter.until) {
      filteredEvents = filteredEvents.filter(event => event.timestamp <= filter.until!)
    }

    // Apply data filter
    if (filter.data) {
      filteredEvents = filteredEvents.filter(event => {
        return Object.entries(filter.data!).every(([key, value]) =>
          event.data[key] === value
        )
      })
    }

    // Get total count before pagination
    const totalCount = filteredEvents.length

    // Apply sorting
    filteredEvents.sort((a, b) => {
      const order = filter.sortOrder === 'asc' ? 1 : -1
      return (a.timestamp.getTime() - b.timestamp.getTime()) * order
    })

    // Apply pagination
    const offset = filter.offset || 0
    const limit = filter.limit

    if (offset > 0) {
      filteredEvents = filteredEvents.slice(offset)
    }

    if (limit) {
      filteredEvents = filteredEvents.slice(0, limit)
    }

    const hasMore = offset + filteredEvents.length < totalCount

    return {
      events: filteredEvents,
      totalCount,
      hasMore,
      nextCursor: hasMore ? String(offset + filteredEvents.length) : undefined
    }
  }

  async getEvent(id: string): Promise<TrokkyEvent | null> {
    return this.events.find(event => event.id === id) || null
  }

  async cleanup(olderThan: Date): Promise<number> {
    const initialCount = this.events.length
    this.events = this.events.filter(event => event.timestamp >= olderThan)
    return initialCount - this.events.length
  }

  async getStats(): Promise<EventStats> {
    const eventsByType: Record<string, number> = {}
    const eventsBySource: Record<string, number> = {}
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    
    let recentEvents = 0
    let weekEvents = 0

    for (const event of this.events) {
      // Count by type
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1

      // Count by source
      eventsBySource[event.source] = (eventsBySource[event.source] || 0) + 1

      // Count recent events
      if (event.timestamp >= oneDayAgo) {
        recentEvents++
      }

      if (event.timestamp >= sevenDaysAgo) {
        weekEvents++
      }
    }

    const avgEventsPerDay = weekEvents / 7

    return {
      totalEvents: this.events.length,
      eventsByType,
      eventsBySource,
      recentEvents,
      avgEventsPerDay
    }
  }

  /**
   * Get all events (for debugging/testing)
   */
  getAllEvents(): TrokkyEvent[] {
    return [...this.events]
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = []
  }

  /**
   * Destroy the storage and clean up resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
    this.clear()
  }

  /**
   * EventStorage teardown. The interval started by `startCleanupTimer` keeps the event loop
   * alive on its own, so a host that stops its server without this still hangs; `destroy()`
   * already clears it, this just puts it on the interface the shutdown path can call.
   * Idempotent: `destroy()` drops the handle, so a second call finds nothing to clear.
   */
  async close(): Promise<void> {
    this.destroy()
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      const cutoffDate = new Date(Date.now() - this.config.maxAge)
      this.cleanup(cutoffDate).catch(error => {
        console.error('Error during automatic event cleanup:', error)
      })
    }, this.config.cleanupInterval)
  }

  private matchesPattern(eventType: string, pattern: string): boolean {
    if (pattern === '*') return true
    if (pattern.endsWith('*')) {
      return eventType.startsWith(pattern.slice(0, -1))
    }
    return eventType === pattern
  }
}