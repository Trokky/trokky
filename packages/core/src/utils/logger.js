"use strict";
/**
 * Trokky Logging System
 *
 * Platform-agnostic logger that works on:
 * - Node.js servers
 * - Edge functions (Cloudflare Workers, Vercel Edge)
 * - Serverless functions (AWS Lambda, Netlify)
 * - Browser environments
 *
 * Features:
 * - Zero filesystem dependencies
 * - Structured logging (JSON when appropriate)
 * - Standard log levels
 * - Environment-based configuration
 * - Color support where available
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerPresets = exports.LoggerFactory = exports.TrokkyLogger = void 0;
exports.createLogger = createLogger;
/**
 * Environment detection
 */
const isNode = typeof process !== 'undefined' && process.versions?.node;
const isBrowser = typeof globalThis !== 'undefined' && typeof globalThis.window !== 'undefined';
const isEdge = typeof globalThis !== 'undefined' && typeof globalThis.EdgeRuntime !== 'undefined';
const isDevelopment = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
/**
 * Default configuration based on environment
 */
const DEFAULT_CONFIG = {
    level: isDevelopment ? 'debug' : 'info',
    format: isDevelopment ? 'human' : 'json',
    timestamp: true,
    colors: Boolean(isNode && !isEdge && process.stdout?.isTTY)
};
/**
 * Log level hierarchy
 */
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};
/**
 * ANSI colors (only used in appropriate environments)
 */
const COLORS = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[32m', // Green  
    warn: '\x1b[33m', // Yellow
    error: '\x1b[31m', // Red
    reset: '\x1b[0m', // Reset
    gray: '\x1b[90m', // Gray
    bold: '\x1b[1m' // Bold
};
/**
 * Platform-agnostic logger
 */
class TrokkyLogger {
    constructor(context, config = {}) {
        this.context = context;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    shouldLog(level) {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
    }
    createLogEntry(level, message, data, error) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context: this.context
        };
        if (data !== undefined) {
            entry.data = data;
        }
        if (error) {
            entry.error = {
                name: error.name,
                message: error.message,
                stack: error.stack
            };
        }
        return entry;
    }
    formatHuman(entry) {
        const parts = [];
        // Timestamp
        if (this.config.timestamp) {
            const time = entry.timestamp.slice(11, 23); // HH:mm:ss.SSS
            const timeStr = this.config.colors ? `${COLORS.gray}${time}${COLORS.reset}` : time;
            parts.push(timeStr);
        }
        // Level with color
        const levelUpper = entry.level.toUpperCase().padEnd(5);
        const levelStr = this.config.colors
            ? `${COLORS[entry.level]}${levelUpper}${COLORS.reset}`
            : levelUpper;
        parts.push(levelStr);
        // Context
        const contextParts = [entry.context.package];
        if (entry.context.component)
            contextParts.push(entry.context.component);
        if (entry.context.operation)
            contextParts.push(entry.context.operation);
        const contextStr = this.config.colors
            ? `${COLORS.gray}[${contextParts.join(':')}]${COLORS.reset}`
            : `[${contextParts.join(':')}]`;
        parts.push(contextStr);
        // Message
        parts.push(entry.message);
        return parts.join(' ');
    }
    formatJson(entry) {
        return JSON.stringify(entry);
    }
    output(entry) {
        const formatted = this.config.format === 'json'
            ? this.formatJson(entry)
            : this.formatHuman(entry);
        // Use appropriate console method
        switch (entry.level) {
            case 'debug':
                console.debug(formatted);
                break;
            case 'info':
                console.info(formatted);
                break;
            case 'warn':
                console.warn(formatted);
                break;
            case 'error':
                console.error(formatted);
                if (entry.error?.stack && this.config.format === 'human') {
                    console.error(entry.error.stack);
                }
                break;
        }
        // Output data separately in human format
        if (entry.data && this.config.format === 'human') {
            const dataStr = typeof entry.data === 'string'
                ? entry.data
                : JSON.stringify(entry.data, null, 2);
            console.log(dataStr);
        }
    }
    debug(message, data) {
        if (this.shouldLog('debug')) {
            this.output(this.createLogEntry('debug', message, data));
        }
    }
    info(message, data) {
        if (this.shouldLog('info')) {
            this.output(this.createLogEntry('info', message, data));
        }
    }
    warn(message, data) {
        if (this.shouldLog('warn')) {
            this.output(this.createLogEntry('warn', message, data));
        }
    }
    error(message, error) {
        if (this.shouldLog('error')) {
            const actualError = error instanceof Error ? error : undefined;
            const data = error instanceof Error ? undefined : error;
            this.output(this.createLogEntry('error', message, data, actualError));
        }
    }
    child(context) {
        return new TrokkyLogger({ ...this.context, ...context }, this.config);
    }
    configure(config) {
        this.config = { ...this.config, ...config };
    }
}
exports.TrokkyLogger = TrokkyLogger;
/**
 * Global logger factory
 */
class LoggerFactory {
    static configure(config) {
        LoggerFactory.globalConfig = { ...LoggerFactory.globalConfig, ...config };
    }
    static create(context) {
        return new TrokkyLogger(context, LoggerFactory.globalConfig);
    }
    static setLevel(level) {
        LoggerFactory.configure({ level });
    }
    static setFormat(format) {
        LoggerFactory.configure({ format });
    }
    static disable() {
        LoggerFactory.configure({ level: 'error' });
    }
}
exports.LoggerFactory = LoggerFactory;
LoggerFactory.globalConfig = {};
/**
 * Convenience function to create package loggers
 */
function createLogger(package_name, component) {
    return LoggerFactory.create({ package: package_name, component });
}
/**
 * Environment-specific configuration helpers
 */
exports.LoggerPresets = {
    development: { level: 'debug', format: 'human', colors: true },
    production: { level: 'info', format: 'json', colors: false },
    testing: { level: 'warn', format: 'human', colors: false },
    edge: { level: 'info', format: 'json', colors: false }
};
