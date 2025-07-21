/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

// Extend Jest matchers if needed
import 'jest'

// Global test timeout (10 seconds for async operations)
jest.setTimeout(10000)

// Mock console methods in tests to avoid noise
global.console = {
  ...console,
  // Suppress console.warn in tests unless explicitly testing it
  warn: jest.fn(),
  // Suppress console.log in tests unless explicitly testing it  
  log: jest.fn(),
  // Keep error and info for debugging
  error: console.error,
  info: console.info
}

// Global test utilities
global.testUtils = {
  /**
   * Create a mock user for testing
   */
  createMockUser: (overrides = {}) => ({
    id: 'test-user-123',
    email: 'test@example.com',
    role: 'editor',
    isActive: true,
    ...overrides
  }),

  /**
   * Create a mock structure for testing
   */
  createMockStructure: (overrides = {}) => ({
    title: 'Test Structure',
    items: [],
    metadata: {
      version: '1.0.0',
      description: 'Test structure for unit tests',
      author: 'Test Suite'
    },
    ...overrides
  }),

  /**
   * Create a mock document list item
   */
  createMockDocumentListItem: (overrides = {}) => ({
    type: 'documentList' as const,
    title: 'Test Documents',
    schemaType: 'testDocument',
    views: [{ type: 'list' }],
    defaultView: 'list',
    ...overrides
  }),

  /**
   * Create a mock query filter
   */
  createMockQueryFilter: (overrides = {}) => ({
    status: { $eq: 'published' },
    ...overrides
  }),

  /**
   * Wait for async operations to complete
   */
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Create a spy function that can be awaited
   */
  createAsyncSpy: <T = any>() => jest.fn<Promise<T>, any[]>()
}

// Type definition for test utilities
interface TestUtils {
  createMockUser: (overrides?: Record<string, any>) => {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
  };
  createMockStructure: (overrides?: Record<string, any>) => {
    title: string;
    items: any[];
    metadata: {
      version: string;
      description: string;
      author: string;
    };
  };
  createMockDocumentListItem: (overrides?: Record<string, any>) => {
    type: 'documentList';
    title: string;
    schemaType: string;
    views: Array<{ type: string }>;
    defaultView: string;
  };
  createMockQueryFilter: (overrides?: Record<string, any>) => Record<string, any>;
  waitFor: (ms: number) => Promise<void>;
  createAsyncSpy: <T = any>() => jest.Mock<Promise<T>, any[]>;
}

// Declare global types for TypeScript
declare global {
  namespace NodeJS {
    interface Global {
      testUtils: TestUtils;
    }
  }
  
  var testUtils: TestUtils;
}