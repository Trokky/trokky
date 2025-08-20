/**
 * Trokky Event Bus Implementation
 *
 * Central event system that handles event emission, listener management,
 * webhook dispatching, and event storage.
 */
import { EventEmitter } from 'events';
import type { TrokkyEvent, EventListenerConfig, EventFilter, EventQueryResult, EventStorage, EventStats, WebhookConfig, WebhookDeliveryResult } from './types.js';
/**
 * Configuration options for the EventBus
 */
export interface EventBusConfig {
    /** Maximum number of events to keep in memory */
    maxHistorySize?: number;
    /** Whether to store events persistently */
    enablePersistence?: boolean;
    /** Event storage adapter */
    storage?: EventStorage;
    /** Whether to enable webhook functionality */
    enableWebhooks?: boolean;
    /** Maximum number of concurrent webhook deliveries */
    maxConcurrentWebhooks?: number;
    /** Data storage adapter for webhook persistence (optional) */
    dataStorage?: any;
}
/**
 * Main EventBus class that orchestrates the entire event system
 */
export declare class TrokkyEventBus extends EventEmitter {
    private config;
    private logger;
    private eventHistory;
    private storage?;
    private webhookRegistry;
    private webhookDeliveries;
    private dataStorage?;
    private customListeners;
    private stats;
    constructor(config?: EventBusConfig);
    /**
     * Emit a Trokky event
     */
    emitEvent(event: Omit<TrokkyEvent, 'id' | 'timestamp'>): Promise<string>;
    /**
     * Emit a complete Trokky event (internal use)
     */
    emitFullEvent(event: TrokkyEvent): Promise<string>;
    /**
     * Add custom event listener
     */
    addCustomListener(config: Omit<EventListenerConfig, 'invocations'>): void;
    /**
     * Remove custom event listener
     */
    removeCustomListener(id: string): boolean;
    /**
     * Register a webhook
     */
    registerWebhook(config: Omit<WebhookConfig, 'createdAt' | 'updatedAt'>): Promise<void>;
    /**
     * Update a webhook
     */
    updateWebhook(id: string, updates: Partial<Omit<WebhookConfig, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean>;
    /**
     * Remove a webhook
     */
    unregisterWebhook(id: string): Promise<boolean>;
    /**
     * Get all registered webhooks
     */
    getWebhooks(): WebhookConfig[];
    /**
     * Get webhook by ID
     */
    getWebhook(id: string): WebhookConfig | null;
    /**
     * Get webhook delivery history
     */
    getWebhookDeliveries(webhookId: string): WebhookDeliveryResult[];
    /**
     * Query events from memory history
     */
    queryEvents(filter?: EventFilter): TrokkyEvent[];
    /**
     * Query events from persistent storage (if available)
     */
    queryEventsFromStorage(filter?: EventFilter): Promise<EventQueryResult>;
    /**
     * Get event statistics
     */
    getEventStats(): Promise<EventStats & {
        runtime: any;
    }>;
    private setupInternalHandlers;
    private addToHistory;
    private executeCustomListeners;
    private shouldExecuteListener;
    private dispatchWebhooks;
    private shouldDispatchToWebhook;
    private dispatchToWebhook;
    private sendWebhookWithRetry;
    private sendWebhookRequest;
    private generateWebhookSignature;
    private calculateRetryDelay;
    private sleep;
    private recordWebhookDelivery;
    private matchesPattern;
    private chunkArray;
    private calculateMemoryStats;
    /**
     * Load webhooks from persistent storage into memory
     */
    private loadWebhooksFromStorage;
}
//# sourceMappingURL=event-bus.d.ts.map