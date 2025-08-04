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
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface LogContext {
    package: string;
    component?: string;
    operation?: string;
}
export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context: LogContext;
    data?: any;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}
export interface LoggerConfig {
    level: LogLevel;
    format: 'human' | 'json';
    timestamp: boolean;
    colors: boolean;
}
/**
 * Platform-agnostic logger
 */
export declare class TrokkyLogger {
    private config;
    private context;
    constructor(context: LogContext, config?: Partial<LoggerConfig>);
    private shouldLog;
    private createLogEntry;
    private formatHuman;
    private formatJson;
    private output;
    debug(message: string, data?: any): void;
    info(message: string, data?: any): void;
    warn(message: string, data?: any): void;
    error(message: string, error?: Error | any): void;
    child(context: Partial<LogContext>): TrokkyLogger;
    configure(config: Partial<LoggerConfig>): void;
}
/**
 * Global logger factory
 */
export declare class LoggerFactory {
    private static globalConfig;
    static configure(config: Partial<LoggerConfig>): void;
    static create(context: LogContext): TrokkyLogger;
    static setLevel(level: LogLevel): void;
    static setFormat(format: 'human' | 'json'): void;
    static disable(): void;
}
/**
 * Convenience function to create package loggers
 */
export declare function createLogger(package_name: string, component?: string): TrokkyLogger;
/**
 * Environment-specific configuration helpers
 */
export declare const LoggerPresets: {
    readonly development: {
        readonly level: LogLevel;
        readonly format: "human";
        readonly colors: true;
    };
    readonly production: {
        readonly level: LogLevel;
        readonly format: "json";
        readonly colors: false;
    };
    readonly testing: {
        readonly level: LogLevel;
        readonly format: "human";
        readonly colors: false;
    };
    readonly edge: {
        readonly level: LogLevel;
        readonly format: "json";
        readonly colors: false;
    };
};
//# sourceMappingURL=logger.d.ts.map