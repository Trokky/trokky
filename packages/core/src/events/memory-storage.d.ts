/**
 * In-Memory Event Storage Implementation
 *
 * Simple event storage that keeps events in memory. Suitable for development
 * and small-scale deployments. For production, consider a database-backed
 * event storage implementation.
 */
import type { EventStorage, TrokkyEvent, EventFilter, EventQueryResult, EventStats } from './types.js';
/**
 * Configuration for memory event storage
 */
export interface MemoryEventStorageConfig {
    /** Maximum number of events to store */
    maxEvents?: number;
    /** Whether to automatically clean up old events */
    autoCleanup?: boolean;
    /** How often to run cleanup (in milliseconds) */
    cleanupInterval?: number;
    /** Maximum age of events before cleanup (in milliseconds) */
    maxAge?: number;
}
/**
 * In-memory implementation of EventStorage
 */
export declare class MemoryEventStorage implements EventStorage {
    private events;
    private config;
    private cleanupTimer?;
    constructor(config?: MemoryEventStorageConfig);
    store(event: TrokkyEvent): Promise<void>;
    query(filter?: EventFilter): Promise<EventQueryResult>;
    getEvent(id: string): Promise<TrokkyEvent | null>;
    cleanup(olderThan: Date): Promise<number>;
    getStats(): Promise<EventStats>;
    /**
     * Get all events (for debugging/testing)
     */
    getAllEvents(): TrokkyEvent[];
    /**
     * Clear all events
     */
    clear(): void;
    /**
     * Destroy the storage and clean up resources
     */
    destroy(): void;
    private startCleanupTimer;
    private matchesPattern;
}
//# sourceMappingURL=memory-storage.d.ts.map