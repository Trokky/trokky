// This jsdom build exposes no localStorage, so tests that exercise persistence
// get a minimal in-memory Storage. Production code is untouched.
if (typeof globalThis.localStorage === 'undefined') {
  const makeStorage = (): Storage => {
    const entries = new Map<string, string>()
    return {
      get length() {
        return entries.size
      },
      key: (index: number) => Array.from(entries.keys())[index] ?? null,
      getItem: (key: string) => (entries.has(key) ? entries.get(key)! : null),
      setItem: (key: string, value: string) => {
        entries.set(key, String(value))
      },
      removeItem: (key: string) => {
        entries.delete(key)
      },
      clear: () => {
        entries.clear()
      },
    } as Storage
  }

  const storage = makeStorage()
  const sessionStorageStub = makeStorage()

  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: sessionStorageStub,
    writable: true,
    configurable: true,
  })
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorageStub,
      writable: true,
      configurable: true,
    })
  }
}

// Mock window.TROKKY_CONFIG for studio tests
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'TROKKY_CONFIG', {
    value: {
      mode: 'development',
      apiBasePath: '/api',
      basePath: '/studio',
      schemas: [],
      branding: { title: 'Test Studio' },
    },
    writable: true,
    configurable: true,
  })
}
