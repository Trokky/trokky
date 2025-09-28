/**
 * Test setup for PostgreSQL adapter tests
 *
 * This file configures the test environment for PostgreSQL adapter testing.
 * It sets up mock database connections and test utilities.
 */

import { jest } from '@jest/globals'

// Mock pg module for unit tests
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
    on: jest.fn()
  })),
  PoolClient: jest.fn()
}))

// Set up test environment variables
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/trokky_test'

// Global test timeout
jest.setTimeout(15000)

// Mock console methods in tests to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}