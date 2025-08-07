/**
 * Test setup for CloudflareD1Adapter
 * Configures Jest environment for testing D1 database operations
 */

// Mock D1 Database for testing
interface MockD1Result {
  results?: any[]
  success: boolean
  meta?: any
}

interface MockD1PreparedStatement {
  bind(...values: any[]): MockD1PreparedStatement
  first<T = any>(): Promise<T | null>
  run(): Promise<MockD1Result>
  all<T = any>(): Promise<{ results: T[] }>
}

interface MockD1Database {
  prepare(query: string): MockD1PreparedStatement
  exec(query: string): Promise<MockD1Result>
}

// Create mock D1 database
export function createMockD1Database(): MockD1Database {
  const storage = new Map<string, any>()
  
  return {
    prepare(query: string) {
      return {
        bind(...values: any[]) {
          return this
        },
        async first<T = any>(): Promise<T | null> {
          // Mock implementation for testing
          return null
        },
        async run(): Promise<MockD1Result> {
          return { success: true }
        },
        async all<T = any>(): Promise<{ results: T[] }> {
          return { results: [] }
        }
      }
    },
    async exec(query: string): Promise<MockD1Result> {
      return { success: true }
    }
  }
}

// Export test utilities - Jest will handle setup/teardown