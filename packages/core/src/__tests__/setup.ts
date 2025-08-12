// Global test setup
global.console = {
  ...console,
  // Suppress console.log during tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}

// Mock File class for media upload tests since Node.js doesn't have native File
global.File = class MockFile {
  name: string
  type: string
  size: number
  
  constructor(bits: any[], filename: string, options: any = {}) {
    this.name = filename
    this.type = options.type || 'application/octet-stream'
    // Calculate size from bits array properly
    if (Array.isArray(bits)) {
      this.size = bits.reduce((total, bit) => {
        if (typeof bit === 'string') return total + bit.length
        if (bit instanceof ArrayBuffer) return total + bit.byteLength
        if (typeof bit === 'number') return total + bit
        return total + String(bit).length
      }, 0)
    } else {
      this.size = 0
    }
  }
} as any
