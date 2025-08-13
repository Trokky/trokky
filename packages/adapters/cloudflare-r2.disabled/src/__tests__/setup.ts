/**
 * Jest setup file for CloudflareR2Adapter tests
 */

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}

// Mock global fetch for AWS SDK requests
global.fetch = jest.fn()

// Add custom matchers or setup code here if needed
beforeEach(() => {
  jest.clearAllMocks()
})