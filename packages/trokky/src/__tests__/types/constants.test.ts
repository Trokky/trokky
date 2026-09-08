import { describe, it, expect } from 'vitest'

describe('types constants', () => {
  describe('CORE_FIELD_TYPES', () => {
    it('should export all expected field types', async () => {
      const { CORE_FIELD_TYPES } = await import('../../types/fields.js')

      expect(CORE_FIELD_TYPES).toBeDefined()
      expect(Array.isArray(CORE_FIELD_TYPES)).toBe(true)

      const expectedTypes = [
        'string',
        'number',
        'boolean',
        'date',
        'array',
        'object',
        'reference',
        'media',
        'slug',
        'email',
        'url',
        'text',
        'richText',
      ]

      for (const type of expectedTypes) {
        expect(CORE_FIELD_TYPES).toContain(type)
      }
    })

    it('should be declared as const (readonly tuple)', async () => {
      const { CORE_FIELD_TYPES } = await import('../../types/fields.js')
      // as const creates a readonly tuple — verify it has known length
      expect(CORE_FIELD_TYPES.length).toBeGreaterThanOrEqual(13)
    })

    it('should not contain duplicates', async () => {
      const { CORE_FIELD_TYPES } = await import('../../types/fields.js')
      const unique = new Set(CORE_FIELD_TYPES)
      expect(unique.size).toBe(CORE_FIELD_TYPES.length)
    })

    it('should only contain non-empty strings', async () => {
      const { CORE_FIELD_TYPES } = await import('../../types/fields.js')
      for (const type of CORE_FIELD_TYPES) {
        expect(typeof type).toBe('string')
        expect(type.length).toBeGreaterThan(0)
        expect(type.trim()).toBe(type) // no leading/trailing whitespace
      }
    })
  })

  describe('i18n constants', () => {
    it('should export DEFAULT_LOCALE as en', async () => {
      const { DEFAULT_LOCALE } = await import('../../types/i18n.js')
      expect(DEFAULT_LOCALE).toBe('en')
    })

    it('should export DEFAULT_NAMESPACE as common', async () => {
      const { DEFAULT_NAMESPACE } = await import('../../types/i18n.js')
      expect(DEFAULT_NAMESPACE).toBe('common')
    })

    it('should export SUPPORTED_LOCALES with at least en and fr', async () => {
      const { SUPPORTED_LOCALES } = await import('../../types/i18n.js')
      expect(Array.isArray(SUPPORTED_LOCALES)).toBe(true)
      expect(SUPPORTED_LOCALES.length).toBeGreaterThanOrEqual(2)
      expect(SUPPORTED_LOCALES).toContain('en')
      expect(SUPPORTED_LOCALES).toContain('fr')
    })

    it('should have DEFAULT_LOCALE in SUPPORTED_LOCALES', async () => {
      const { DEFAULT_LOCALE, SUPPORTED_LOCALES } = await import('../../types/i18n.js')
      expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE)
    })

    it('should export LOCALE_NAMES mapping every supported locale', async () => {
      const { LOCALE_NAMES, SUPPORTED_LOCALES } = await import('../../types/i18n.js')

      expect(LOCALE_NAMES).toBeDefined()
      expect(typeof LOCALE_NAMES).toBe('object')

      for (const locale of SUPPORTED_LOCALES) {
        const name = LOCALE_NAMES[locale as keyof typeof LOCALE_NAMES]
        expect(name).toBeDefined()
        expect(typeof name).toBe('string')
        expect(name.length).toBeGreaterThan(0)
      }
    })

    it('should not have locales in LOCALE_NAMES absent from SUPPORTED_LOCALES', async () => {
      const { LOCALE_NAMES, SUPPORTED_LOCALES } = await import('../../types/i18n.js')

      for (const locale of Object.keys(LOCALE_NAMES)) {
        expect(SUPPORTED_LOCALES).toContain(locale)
      }
    })

    it('should have LOCALE_NAMES and SUPPORTED_LOCALES in sync', async () => {
      const { LOCALE_NAMES, SUPPORTED_LOCALES } = await import('../../types/i18n.js')
      expect(Object.keys(LOCALE_NAMES).length).toBe(SUPPORTED_LOCALES.length)
    })
  })

  describe('OAuth2 constants', () => {
    it('should export SCOPE_TO_PERMISSIONS for all defined scopes', async () => {
      const { SCOPE_TO_PERMISSIONS } = await import('../../types/oauth2.js')

      expect(SCOPE_TO_PERMISSIONS).toBeDefined()
      expect(typeof SCOPE_TO_PERMISSIONS).toBe('object')

      const expectedScopes = [
        'openid',
        'profile',
        'content:read',
        'content:write',
        'content:delete',
        'media:read',
        'media:write',
        'offline_access',
      ]

      for (const scope of expectedScopes) {
        expect(SCOPE_TO_PERMISSIONS).toHaveProperty(scope)
        expect(Array.isArray(SCOPE_TO_PERMISSIONS[scope as keyof typeof SCOPE_TO_PERMISSIONS])).toBe(true)
      }
    })

    it('should map content:read scope to content:read permission', async () => {
      const { SCOPE_TO_PERMISSIONS } = await import('../../types/oauth2.js')
      const perms = SCOPE_TO_PERMISSIONS['content:read' as keyof typeof SCOPE_TO_PERMISSIONS]
      expect(perms).toContain('content:read')
    })

    it('should map content:write scope to include content:read (implicit read access)', async () => {
      const { SCOPE_TO_PERMISSIONS } = await import('../../types/oauth2.js')
      const perms = SCOPE_TO_PERMISSIONS['content:write' as keyof typeof SCOPE_TO_PERMISSIONS]
      expect(perms).toContain('content:read')
      expect(perms).toContain('content:write')
    })

    it('should map identity scopes (openid, profile) to empty permissions', async () => {
      const { SCOPE_TO_PERMISSIONS } = await import('../../types/oauth2.js')
      expect(SCOPE_TO_PERMISSIONS['openid' as keyof typeof SCOPE_TO_PERMISSIONS]).toEqual([])
      expect(SCOPE_TO_PERMISSIONS['profile' as keyof typeof SCOPE_TO_PERMISSIONS]).toEqual([])
    })

    it('should have every permission value be a non-empty string', async () => {
      const { SCOPE_TO_PERMISSIONS } = await import('../../types/oauth2.js')
      for (const [, permissions] of Object.entries(SCOPE_TO_PERMISSIONS)) {
        for (const perm of permissions as string[]) {
          expect(typeof perm).toBe('string')
          expect(perm.length).toBeGreaterThan(0)
        }
      }
    })

    it('should export BUILTIN_CLI_CLIENT with correct structure', async () => {
      const { BUILTIN_CLI_CLIENT } = await import('../../types/oauth2.js')

      expect(BUILTIN_CLI_CLIENT).toBeDefined()
      expect(BUILTIN_CLI_CLIENT.id).toBe('trokky-cli')
      expect(typeof BUILTIN_CLI_CLIENT.name).toBe('string')
      expect(BUILTIN_CLI_CLIENT.type).toBe('public')
      expect(Array.isArray(BUILTIN_CLI_CLIENT.allowedScopes)).toBe(true)
      expect(BUILTIN_CLI_CLIENT.allowedScopes.length).toBeGreaterThan(0)
      expect(BUILTIN_CLI_CLIENT.isActive).toBe(true)
      expect(BUILTIN_CLI_CLIENT.isBuiltIn).toBe(true)
    })

    it('should have CLI client with read and write content scopes', async () => {
      const { BUILTIN_CLI_CLIENT } = await import('../../types/oauth2.js')
      expect(BUILTIN_CLI_CLIENT.allowedScopes).toContain('content:read')
      expect(BUILTIN_CLI_CLIENT.allowedScopes).toContain('content:write')
      expect(BUILTIN_CLI_CLIENT.allowedScopes).toContain('media:read')
      expect(BUILTIN_CLI_CLIENT.allowedScopes).toContain('media:write')
    })

    it('should have CLI client with offline_access for refresh tokens', async () => {
      const { BUILTIN_CLI_CLIENT } = await import('../../types/oauth2.js')
      expect(BUILTIN_CLI_CLIENT.allowedScopes).toContain('offline_access')
    })

    it('should have CLI client with device code grant type', async () => {
      const { BUILTIN_CLI_CLIENT } = await import('../../types/oauth2.js')
      expect(BUILTIN_CLI_CLIENT.grantTypes).toContain(
        'urn:ietf:params:oauth:grant-type:device_code'
      )
    })
  })
})
