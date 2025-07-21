/**
 * Jest setup file for client SDK tests
 */

// Mock fetch for Node.js environment
global.fetch = jest.fn()
global.FormData = jest.fn().mockImplementation(() => ({
  append: jest.fn(),
  set: jest.fn(),
  get: jest.fn(),
  has: jest.fn(),
  delete: jest.fn(),
  entries: jest.fn(),
  forEach: jest.fn(),
  keys: jest.fn(),
  values: jest.fn()
}))
global.Blob = jest.fn().mockImplementation((chunks, options) => ({
  size: chunks ? chunks.reduce((acc: number, chunk: any) => acc + (chunk.length || 0), 0) : 0,
  type: options?.type || '',
  arrayBuffer: jest.fn(),
  slice: jest.fn(),
  stream: jest.fn(),
  text: jest.fn()
}))

// Mock AbortSignal for timeout support
const mockAbortSignal = {
  aborted: false,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  onabort: null,
  reason: undefined
}

global.AbortSignal = {
  timeout: jest.fn().mockImplementation((ms: number) => mockAbortSignal)
} as any

// Setup console to avoid noise in tests
const originalConsole = console
beforeEach(() => {
  console.log = jest.fn()
  console.warn = jest.fn()
  console.error = jest.fn()
})

afterEach(() => {
  console.log = originalConsole.log
  console.warn = originalConsole.warn
  console.error = originalConsole.error
  jest.clearAllMocks()
})