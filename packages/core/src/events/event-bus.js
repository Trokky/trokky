/**
 * Trokky Event Bus Implementation
 *
 * Central event system that handles event emission, listener management,
 * webhook dispatching, and event storage.
 */
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger.js';
import { generateUUID } from '../utils/universal-crypto.js';
/**
 * Main EventBus class that orchestrates the entire event system
 */
export class TrokkyEventBus extends EventEmitter {
    constructor(config = {}) {
        super();
        this.logger = createLogger('events', 'EventBus');
        // Event storage
        this.eventHistory = [];
        // Webhook management
        this.webhookRegistry = new Map();
        this.webhookDeliveries = new Map();
        // Listener management
        this.customListeners = new Map();
        // Statistics
        this.stats = {
            eventsEmitted: 0,
            webhooksDelivered: 0,
            webhooksFailed: 0,
            listenersExecuted: 0
        };
        this.config = {
            maxHistorySize: config.maxHistorySize || 1000,
            enablePersistence: config.enablePersistence || false,
            storage: config.storage,
            dataStorage: config.dataStorage,
            enableWebhooks: config.enableWebhooks || true,
            maxConcurrentWebhooks: config.maxConcurrentWebhooks || 10
        };
        this.storage = this.config.storage;
        this.dataStorage = this.config.dataStorage;
        // Set up internal event handlers
        this.setupInternalHandlers();
        // Load existing webhooks from storage if available
        if (this.config.enableWebhooks && this.dataStorage) {
            this.loadWebhooksFromStorage().catch(error => {
                this.logger.warn('Failed to load webhooks from storage', { error });
            });
        }
        this.logger.info('EventBus initialized', {
            config: {
                maxHistorySize: this.config.maxHistorySize,
                enablePersistence: this.config.enablePersistence,
                enableWebhooks: this.config.enableWebhooks,
                webhookPersistence: !!this.config.dataStorage
            }
        });
    }
    // ==========================================================================
    // EVENT EMISSION AND HANDLING
    // ==========================================================================
    /**
     * Emit a Trokky event
     */
    async emitEvent(event) {
        // Generate ID and timestamp if not provided
        const fullEvent = {
            id: generateUUID(),
            timestamp: new Date(),
            ...event
        };
        return this.emitFullEvent(fullEvent);
    }
    /**
     * Emit a complete Trokky event (internal use)
     */
    async emitFullEvent(event) {
        try {
            // Add to memory history
            this.addToHistory(event);
            // Store persistently if enabled
            if (this.config.enablePersistence && this.storage) {
                await this.storage.store(event).catch(error => {
                    this.logger.error('Failed to store event persistently', { error, eventId: event.id });
                });
            }
            // Emit to Node.js EventEmitter listeners
            this.emit(event.type, event);
            this.emit('*', event); // Wildcard listeners
            // Execute custom listeners
            await this.executeCustomListeners(event);
            // Dispatch webhooks if enabled
            if (this.config.enableWebhooks) {
                this.dispatchWebhooks(event).catch(error => {
                    this.logger.error('Webhook dispatch failed', { error, eventId: event.id });
                });
            }
            // Update statistics
            this.stats.eventsEmitted++;
            this.logger.debug(`Event emitted: ${event.type}`, {
                eventId: event.id,
                actor: event.actor,
                source: event.source
            });
            return event.id;
        }
        catch (error) {
            this.logger.error('Failed to emit event', { error, event });
            throw error;
        }
    }
    /**
     * Add custom event listener
     */
    addCustomListener(config) {
        const fullConfig = {
            ...config,
            invocations: 0
        };
        this.customListeners.set(config.id, fullConfig);
        this.logger.debug('Event listener added', {
            id: config.id,
            pattern: config.pattern,
            async: config.async
        });
    }
    /**
     * Remove custom event listener
     */
    removeCustomListener(id) {
        const removed = this.customListeners.delete(id);
        if (removed) {
            this.logger.debug('Event listener removed', { id });
        }
        return removed;
    }
    // ==========================================================================
    // WEBHOOK MANAGEMENT
    // ==========================================================================
    /**
     * Register a webhook
     */
    async registerWebhook(config) {
        const fullConfig = {
            ...config,
            createdAt: new Date(),
            updatedAt: new Date(),
            retryPolicy: config.retryPolicy || {
                maxRetries: 3,
                backoffType: 'exponential',
                baseDelay: 1000,
                maxDelay: 30000,
                retryOnStatus: [500, 502, 503, 504, 408, 429]
            }
        };
        // Save to memory registry
        this.webhookRegistry.set(config.id, fullConfig);
        // Save to persistent storage if available
        if (this.dataStorage && this.dataStorage.saveWebhook) {
            try {
                await this.dataStorage.saveWebhook(config.id, fullConfig);
            }
            catch (error) {
                this.logger.error('Failed to persist webhook to storage', { error, id: config.id });
                // Continue anyway - webhook is still in memory
            }
        }
        this.logger.info('Webhook registered', {
            id: config.id,
            name: config.name,
            url: config.url,
            events: config.events,
            active: config.active,
            persisted: !!this.dataStorage
        });
    }
    /**
     * Update a webhook
     */
    async updateWebhook(id, updates) {
        const existing = this.webhookRegistry.get(id);
        if (!existing)
            return false;
        const updated = {
            ...existing,
            ...updates,
            updatedAt: new Date()
        };
        // Update in memory registry
        this.webhookRegistry.set(id, updated);
        // Update in persistent storage if available
        if (this.dataStorage && this.dataStorage.saveWebhook) {
            try {
                await this.dataStorage.saveWebhook(id, updated);
            }
            catch (error) {
                this.logger.error('Failed to persist webhook update to storage', { error, id });
                // Continue anyway - webhook is updated in memory
            }
        }
        this.logger.info('Webhook updated', { id, updates, persisted: !!this.dataStorage });
        return true;
    }
    /**
     * Remove a webhook
     */
    async unregisterWebhook(id) {
        const removed = this.webhookRegistry.delete(id);
        if (removed) {
            // Remove from persistent storage if available
            if (this.dataStorage && this.dataStorage.deleteWebhook) {
                try {
                    await this.dataStorage.deleteWebhook(id);
                }
                catch (error) {
                    this.logger.error('Failed to delete webhook from storage', { error, id });
                    // Continue anyway - webhook is removed from memory
                }
            }
            this.webhookDeliveries.delete(id);
            this.logger.info('Webhook unregistered', { id, persisted: !!this.dataStorage });
        }
        return removed;
    }
    /**
     * Get all registered webhooks
     */
    getWebhooks() {
        return Array.from(this.webhookRegistry.values());
    }
    /**
     * Get webhook by ID
     */
    getWebhook(id) {
        return this.webhookRegistry.get(id) || null;
    }
    /**
     * Get webhook delivery history
     */
    getWebhookDeliveries(webhookId) {
        return this.webhookDeliveries.get(webhookId) || [];
    }
    // ==========================================================================
    // EVENT QUERYING
    // ==========================================================================
    /**
     * Query events from memory history
     */
    queryEvents(filter = {}) {
        let events = [...this.eventHistory];
        // Apply filters
        if (filter.type) {
            const types = Array.isArray(filter.type) ? filter.type : [filter.type];
            events = events.filter(event => types.some(type => this.matchesPattern(event.type, type)));
        }
        if (filter.actor) {
            events = events.filter(event => event.actor?.id === filter.actor);
        }
        if (filter.source) {
            const sources = Array.isArray(filter.source) ? filter.source : [filter.source];
            events = events.filter(event => sources.includes(event.source));
        }
        if (filter.since) {
            events = events.filter(event => event.timestamp >= filter.since);
        }
        if (filter.until) {
            events = events.filter(event => event.timestamp <= filter.until);
        }
        if (filter.data) {
            events = events.filter(event => {
                return Object.entries(filter.data).every(([key, value]) => event.data[key] === value);
            });
        }
        // Sort by timestamp
        events.sort((a, b) => {
            const order = filter.sortOrder === 'asc' ? 1 : -1;
            return (a.timestamp.getTime() - b.timestamp.getTime()) * order;
        });
        // Apply pagination
        if (filter.offset) {
            events = events.slice(filter.offset);
        }
        if (filter.limit) {
            events = events.slice(0, filter.limit);
        }
        return events;
    }
    /**
     * Query events from persistent storage (if available)
     */
    async queryEventsFromStorage(filter) {
        if (!this.storage) {
            // Fallback to memory query
            const events = this.queryEvents(filter);
            return {
                events,
                totalCount: events.length,
                hasMore: false
            };
        }
        return this.storage.query(filter);
    }
    /**
     * Get event statistics
     */
    async getEventStats() {
        let persistentStats = null;
        if (this.storage) {
            try {
                persistentStats = await this.storage.getStats();
            }
            catch (error) {
                this.logger.warn('Failed to get persistent event stats', error);
            }
        }
        // Memory-based stats from current session
        const memoryStats = this.calculateMemoryStats();
        return {
            ...memoryStats,
            ...(persistentStats || {}),
            runtime: this.stats
        };
    }
    // ==========================================================================
    // PRIVATE METHODS
    // ==========================================================================
    setupInternalHandlers() {
        // Handle webhook delivery events
        this.on('webhook.delivered', (event) => {
            this.stats.webhooksDelivered++;
        });
        this.on('webhook.failed', (event) => {
            this.stats.webhooksFailed++;
        });
    }
    addToHistory(event) {
        this.eventHistory.push(event);
        // Trim history if it exceeds max size
        if (this.eventHistory.length > this.config.maxHistorySize) {
            this.eventHistory = this.eventHistory.slice(-this.config.maxHistorySize);
        }
    }
    async executeCustomListeners(event) {
        const matchingListeners = Array.from(this.customListeners.values())
            .filter(listener => this.shouldExecuteListener(listener, event));
        for (const listener of matchingListeners) {
            try {
                // Check max invocations
                if (listener.maxInvocations && listener.invocations >= listener.maxInvocations) {
                    this.customListeners.delete(listener.id);
                    continue;
                }
                // Execute listener
                if (listener.async) {
                    // Don't await async listeners
                    const result = listener.handler(event);
                    if (result) {
                        result.catch(error => {
                            this.logger.error('Async event listener failed', {
                                error,
                                listenerId: listener.id,
                                eventId: event.id
                            });
                        });
                    }
                }
                else {
                    const result = listener.handler(event);
                    if (result instanceof Promise) {
                        await result;
                    }
                }
                // Update invocation count
                listener.invocations++;
                this.stats.listenersExecuted++;
            }
            catch (error) {
                this.logger.error('Event listener failed', {
                    error,
                    listenerId: listener.id,
                    eventId: event.id
                });
            }
        }
    }
    shouldExecuteListener(listener, event) {
        const patterns = Array.isArray(listener.pattern) ? listener.pattern : [listener.pattern];
        return patterns.some(pattern => this.matchesPattern(event.type, pattern));
    }
    async dispatchWebhooks(event) {
        const activeWebhooks = Array.from(this.webhookRegistry.values())
            .filter(webhook => webhook.active && this.shouldDispatchToWebhook(webhook, event));
        if (activeWebhooks.length === 0)
            return;
        // Dispatch webhooks with concurrency limit
        const batches = this.chunkArray(activeWebhooks, this.config.maxConcurrentWebhooks);
        for (const batch of batches) {
            await Promise.allSettled(batch.map(webhook => this.dispatchToWebhook(webhook, event)));
        }
    }
    shouldDispatchToWebhook(webhook, event) {
        return webhook.events.some(pattern => this.matchesPattern(event.type, pattern));
    }
    async dispatchToWebhook(webhook, event) {
        const startTime = Date.now();
        const deliveryId = generateUUID();
        const payload = {
            webhook: {
                id: webhook.id,
                name: webhook.name
            },
            event,
            delivery: {
                id: deliveryId,
                timestamp: new Date(),
                attempt: 1
            }
        };
        try {
            const result = await this.sendWebhookWithRetry(webhook, payload);
            // Record successful delivery
            this.recordWebhookDelivery(webhook.id, {
                ...result,
                deliveryId,
                success: true,
                responseTime: Date.now() - startTime,
                timestamp: new Date(),
                attempt: 1
            });
            // Emit webhook delivered event
            await this.emitEvent({
                type: 'webhook.delivered',
                source: 'system',
                data: {
                    webhookId: webhook.id,
                    url: webhook.url,
                    originalEvent: event,
                    attempt: 1,
                    statusCode: result.statusCode,
                    responseTime: result.responseTime
                }
            });
        }
        catch (error) {
            // Record failed delivery
            this.recordWebhookDelivery(webhook.id, {
                deliveryId,
                success: false,
                responseTime: Date.now() - startTime,
                timestamp: new Date(),
                attempt: 1,
                error: error instanceof Error ? error.message : String(error)
            });
            // Emit webhook failed event
            await this.emitEvent({
                type: 'webhook.failed',
                source: 'system',
                data: {
                    webhookId: webhook.id,
                    url: webhook.url,
                    originalEvent: event,
                    attempt: 1,
                    error: error instanceof Error ? error.message : String(error)
                }
            });
        }
    }
    async sendWebhookWithRetry(webhook, payload) {
        const retryPolicy = webhook.retryPolicy;
        let lastError = null;
        for (let attempt = 1; attempt <= retryPolicy.maxRetries + 1; attempt++) {
            try {
                payload.delivery.attempt = attempt;
                const result = await this.sendWebhookRequest(webhook, payload);
                return {
                    deliveryId: payload.delivery.id,
                    success: true,
                    statusCode: result.status,
                    responseTime: result.responseTime,
                    timestamp: new Date(),
                    attempt
                };
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                // Don't retry if we've exhausted attempts
                if (attempt > retryPolicy.maxRetries)
                    break;
                // Don't retry on certain status codes
                if (error instanceof Error && 'statusCode' in error) {
                    const statusCode = error.statusCode;
                    if (retryPolicy.retryOnStatus && !retryPolicy.retryOnStatus.includes(statusCode)) {
                        break;
                    }
                }
                // Calculate delay for next attempt
                const delay = this.calculateRetryDelay(attempt, retryPolicy);
                await this.sleep(delay);
            }
        }
        throw lastError;
    }
    async sendWebhookRequest(webhook, payload) {
        const startTime = Date.now();
        const signature = await this.generateWebhookSignature(webhook.secret, payload);
        const response = await fetch(webhook.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Trokky-Webhooks/1.0',
                'X-Trokky-Signature': signature,
                'X-Trokky-Event': payload.event.type,
                'X-Trokky-Delivery': payload.delivery.id,
                ...(webhook.headers || {})
            },
            body: JSON.stringify(payload)
        });
        const responseTime = Date.now() - startTime;
        if (!response.ok) {
            const error = new Error(`Webhook returned ${response.status}: ${response.statusText}`);
            error.statusCode = response.status;
            throw error;
        }
        return { status: response.status, responseTime };
    }
    async generateWebhookSignature(secret, payload) {
        // Using crypto to generate HMAC-SHA256 signature
        const crypto = await import('crypto');
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(JSON.stringify(payload));
        return `sha256=${hmac.digest('hex')}`;
    }
    calculateRetryDelay(attempt, policy) {
        let delay;
        if (policy.backoffType === 'linear') {
            delay = policy.baseDelay * attempt;
        }
        else {
            delay = policy.baseDelay * Math.pow(2, attempt - 1);
        }
        if (policy.maxDelay) {
            delay = Math.min(delay, policy.maxDelay);
        }
        return delay;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    recordWebhookDelivery(webhookId, result) {
        if (!this.webhookDeliveries.has(webhookId)) {
            this.webhookDeliveries.set(webhookId, []);
        }
        const deliveries = this.webhookDeliveries.get(webhookId);
        deliveries.push(result);
        // Keep only last 100 deliveries per webhook
        if (deliveries.length > 100) {
            deliveries.splice(0, deliveries.length - 100);
        }
    }
    matchesPattern(eventType, pattern) {
        if (pattern === '*')
            return true;
        if (pattern.endsWith('*')) {
            return eventType.startsWith(pattern.slice(0, -1));
        }
        return eventType === pattern;
    }
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
    calculateMemoryStats() {
        const eventsByType = {};
        const eventsBySource = {};
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        let recentEvents = 0;
        for (const event of this.eventHistory) {
            // Count by type
            eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
            // Count by source
            eventsBySource[event.source] = (eventsBySource[event.source] || 0) + 1;
            // Count recent events
            if (event.timestamp >= oneDayAgo) {
                recentEvents++;
            }
        }
        return {
            totalEvents: this.eventHistory.length,
            eventsByType,
            eventsBySource,
            recentEvents,
            avgEventsPerDay: recentEvents // Simplified for memory stats
        };
    }
    /**
     * Load webhooks from persistent storage into memory
     */
    async loadWebhooksFromStorage() {
        if (!this.dataStorage || !this.dataStorage.listWebhooks) {
            return;
        }
        try {
            const storedWebhooks = await this.dataStorage.listWebhooks();
            for (const webhook of storedWebhooks) {
                this.webhookRegistry.set(webhook.id, webhook);
            }
            this.logger.info('Loaded webhooks from storage', {
                count: storedWebhooks.length,
                webhookIds: storedWebhooks.map((w) => w.id)
            });
        }
        catch (error) {
            this.logger.error('Failed to load webhooks from storage', { error });
            throw error;
        }
    }
}
//# sourceMappingURL=event-bus.js.map