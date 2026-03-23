import { describe, it, expect } from 'vitest'

describe('i18n', () => {
  // config.ts imports react-i18next which requires React.
  // These tests verify the module loads in environments where React is available.
  // In the server package (no React), we test types/constants only.
  describe('types and constants', () => {
    it('should export locale constants', async () => {
      const mod = await import('../../i18n/types.js')
      expect(mod.DEFAULT_LOCALE).toBe('en')
      expect(mod.DEFAULT_NAMESPACE).toBe('common')
      expect(mod.SUPPORTED_LOCALES).toContain('en')
      expect(mod.SUPPORTED_LOCALES).toContain('fr')
    })

    it('should export LOCALE_NAMES', async () => {
      const { LOCALE_NAMES } = await import('../../i18n/types.js')
      expect(LOCALE_NAMES.en).toBeDefined()
      expect(LOCALE_NAMES.fr).toBeDefined()
    })

    it('should have DEFAULT_LOCALE in SUPPORTED_LOCALES', async () => {
      const { DEFAULT_LOCALE, SUPPORTED_LOCALES } = await import('../../i18n/types.js')
      expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE)
    })
  })
})
