import { describe, it, expect } from 'vitest'

describe('i18n', () => {
  describe('config', () => {
    it('should export initI18n function', async () => {
      const mod = await import('../../i18n/config.js')
      expect(mod.initI18n).toBeDefined()
      expect(typeof mod.initI18n).toBe('function')
    })

    it('should export resources with en and fr', async () => {
      const mod = await import('../../i18n/config.js')
      expect(mod.resources).toBeDefined()
      expect(mod.resources.en).toBeDefined()
      expect(mod.resources.fr).toBeDefined()
    })

    it('should have common namespace in en resources', async () => {
      const mod = await import('../../i18n/config.js')
      expect(mod.resources.en.common).toBeDefined()
    })

    it('should have studio namespace in both locales', async () => {
      const mod = await import('../../i18n/config.js')
      expect(mod.resources.en.studio).toBeDefined()
      expect(mod.resources.fr.studio).toBeDefined()
    })

    it('should have fields namespace in both locales', async () => {
      const mod = await import('../../i18n/config.js')
      expect(mod.resources.en.fields).toBeDefined()
      expect(mod.resources.fr.fields).toBeDefined()
    })

    it('should have auth namespace in both locales', async () => {
      const mod = await import('../../i18n/config.js')
      expect(mod.resources.en.auth).toBeDefined()
      expect(mod.resources.fr.auth).toBeDefined()
    })

    it('should have errors namespace in both locales', async () => {
      const mod = await import('../../i18n/config.js')
      expect(mod.resources.en.errors).toBeDefined()
      expect(mod.resources.fr.errors).toBeDefined()
    })

    it('should export isValidLocale function', async () => {
      const mod = await import('../../i18n/config.js')
      expect(mod.isValidLocale).toBeDefined()
      expect(mod.isValidLocale('en')).toBe(true)
      expect(mod.isValidLocale('fr')).toBe(true)
      expect(mod.isValidLocale('de')).toBe(false)
    })
  })

  describe('types', () => {
    it('should export locale constants', async () => {
      const { DEFAULT_LOCALE, SUPPORTED_LOCALES, LOCALE_NAMES } = await import('../../i18n/types.js')
      expect(DEFAULT_LOCALE).toBe('en')
      expect(SUPPORTED_LOCALES).toContain('en')
      expect(SUPPORTED_LOCALES).toContain('fr')
      expect(LOCALE_NAMES.en).toBeDefined()
      expect(LOCALE_NAMES.fr).toBeDefined()
    })
  })
})
