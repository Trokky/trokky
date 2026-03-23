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
