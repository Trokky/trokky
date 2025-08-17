/**
 * Studio Logger Utility
 * Provides consistent logging throughout the Studio with controllable levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug: (message: string, data?: any) => void;
  info: (message: string, data?: any) => void;
  warn: (message: string, data?: any) => void;
  error: (message: string, error?: Error | any) => void;
}

// Global logger control (accessible from browser console)
declare global {
  interface Window {
    TrokkyLogger?: {
      setLevel: (level: LogLevel) => void;
      getLevel: () => LogLevel;
      enable: () => void;
      disable: () => void;
    };
  }
}

let currentLogLevel: LogLevel = 'info';
let isEnabled = true;

// Initialize global logger control
if (typeof window !== 'undefined') {
  window.TrokkyLogger = {
    setLevel: (level: LogLevel) => {
      currentLogLevel = level;
      console.log(`[TrokkyLogger] Log level set to: ${level}`);
    },
    getLevel: () => currentLogLevel,
    enable: () => {
      isEnabled = true;
      console.log('[TrokkyLogger] Logging enabled');
    },
    disable: () => {
      isEnabled = false;
      console.log('[TrokkyLogger] Logging disabled');
    }
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

function shouldLog(level: LogLevel): boolean {
  return isEnabled && LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
}

function formatMessage(component: string, message: string): string {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  return `[${timestamp}] [${component}] ${message}`;
}

export function createStudioLogger(component: string): Logger {
  return {
    debug: (message: string, data?: any) => {
      if (shouldLog('debug')) {
        if (data) {
          console.debug(formatMessage(component, message), data);
        } else {
          console.debug(formatMessage(component, message));
        }
      }
    },
    
    info: (message: string, data?: any) => {
      if (shouldLog('info')) {
        if (data) {
          console.info(formatMessage(component, message), data);
        } else {
          console.info(formatMessage(component, message));
        }
      }
    },
    
    warn: (message: string, data?: any) => {
      if (shouldLog('warn')) {
        if (data) {
          console.warn(formatMessage(component, message), data);
        } else {
          console.warn(formatMessage(component, message));
        }
      }
    },
    
    error: (message: string, error?: Error | any) => {
      if (shouldLog('error')) {
        if (error) {
          console.error(formatMessage(component, message), error);
        } else {
          console.error(formatMessage(component, message));
        }
      }
    }
  };
}

// Set development defaults
if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
  currentLogLevel = 'debug';
}