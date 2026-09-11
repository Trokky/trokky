/**
 * ConfigRoutes - Schema, structure, studio configuration and settings handlers
 */

import { InvalidInputError } from '../../core/index.js'
import type { HttpRequest, HttpResponse, RouteDefinition } from '../types.js'
import { isSingletonSchema } from '../../core/schema/singleton.js'
import { BaseRoutes } from './base.js'

export class ConfigRoutes extends BaseRoutes {
  public getRoutes(): RouteDefinition[] {
    const basePath = this.config.basePath || ''
    return this.defineRoutes([
      ['GET', `${basePath}/schemas/:schemaName`, this.getSchema.bind(this)],
      ['GET', `${basePath}/config/structure`, this.getStructure.bind(this)],
      ['GET', `${basePath}/config/studio`, this.getStudioConfig.bind(this)],
      ['GET', `${basePath}/config/settings`, this.getSettings.bind(this)],
      ['PUT', `${basePath}/config/settings`, this.updateSettings.bind(this)]
    ])
  }

  // Schema Routes
  private async getSchema(request: HttpRequest): Promise<HttpResponse> {
    try {
      await this.validateAuthentication(request)

      const { schemaName } = request.params
      if (!schemaName) {
        return this.errorResponse(new InvalidInputError('Schema name is required'))
      }

      const schema = this.core.getSchema(schemaName)
      if (!schema) {
        return this.errorResponse(new Error('Schema not found'), 404)
      }

      return this.successResponse({ schema })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  // Configuration Routes
  private async getStructure(request: HttpRequest): Promise<HttpResponse> {
    try {
      await this.validateAuthentication(request)

      // Get current user for context-aware structure generation
      const user = await this.getCurrentUser(request)
      const schemas = this.core.getAllSchemas()

      // Get custom structure function from config if available
      const customStructure = this.getCustomStructureFunction()

      let structure: any

      if (customStructure && typeof customStructure === 'function') {
        // Execute custom structure function with context
        const context = {
          user,
          schemas,
          core: this.core,
          config: this.config
        }

        this.logger.debug('Executing custom structure function', {
          userId: user?.id,
          userRole: user?.role,
          schemasCount: schemas.length
        })

        structure = await Promise.resolve(customStructure(context))
      } else if (customStructure && typeof customStructure === 'object') {
        // Use static structure
        structure = customStructure
      } else {
        // Fall back to auto-generated structure
        structure = await this.buildDefaultStructure(user, schemas)
      }

      this.logger.debug('Generated dynamic structure', {
        title: structure.title,
        itemsCount: structure.items?.length || 0,
        userId: user?.id
      })

      // Enrich structure items with schema titles for better Create menu display
      const enrichedStructure = this.enrichStructureWithSchemaInfo(structure, schemas)

      return this.successResponse({ structure: enrichedStructure })
    } catch (error) {
      this.logger.error('Failed to get structure', {
        error: error instanceof Error ? error.message : String(error)
      })
      return this.errorResponse(error)
    }
  }

  /**
   * Enrich structure items with schema information
   * Adds schemaTitle field to documentList items for better Create menu display
   */
  private enrichStructureWithSchemaInfo(structure: any, schemas: any[]): any {
    const schemaMap = new Map(schemas.map(s => [s.name, s]))

    const enrichItems = (items: any[]): any[] => {
      return items.map(item => {
        if (item.type === 'documentList' && item.schemaType) {
          const schema = schemaMap.get(item.schemaType)
          return {
            ...item,
            schemaTitle: schema?.title || item.schemaType,
            // A custom structure may list a singleton schema. Tell the Studio, so it does not
            // offer a Create the server will reject once the one document exists.
            schemaIsSingleton: isSingletonSchema(schema)
          }
        } else if (item.type === 'group' && item.items) {
          return {
            ...item,
            items: enrichItems(item.items)
          }
        }
        return item
      })
    }

    return {
      ...structure,
      items: enrichItems(structure.items || [])
    }
  }

  /**
   * Get studio configuration from trokky.config
   */
  private async getStudioConfig(request: HttpRequest): Promise<HttpResponse> {
    try {
      // Public endpoint - no authentication required for branding access on login page

      // Get studio configuration from global config or fallback
      const studioConfig = this.config.studioConfig || {
        branding: { title: 'Trokky Studio' },
        enabled: true,
        path: '/studio',
        requireAuth: true
      }

      // Fetch settings from storage to get branding configuration
      const dataStorage = this.core.getDataStorageAdapter()
      let brandingFromSettings = {}

      if (dataStorage && dataStorage.getSettings) {
        try {
          const settings = await dataStorage.getSettings()
          if (settings) {
            // Merge branding fields from settings
            brandingFromSettings = {
              title: settings.studioTitle || studioConfig.branding?.title,
              organizationName: settings.organizationName,
              primaryColor: settings.primaryColor,
              secondaryColor: settings.secondaryColor,
              logo: settings.logo,
            }
          }
        } catch (error) {
          this.logger.warn('Failed to fetch settings for branding', {
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }

      // Merge branding from settings with global config
      const mergedBranding = {
        ...studioConfig.branding,
        ...brandingFromSettings
      }

      // Add MediaUrlGenerator configuration for media URL generation
      // Use mediaUrlGenerator from global config if available
      const mediaUrlGenerator = studioConfig.mediaUrlGenerator || {
        options: {
          apiBasePath: studioConfig.apiBasePath || "/api",
          mediaConfig: {
            serving: {
              mode: "api" // Always use API mode for media serving
            }
          }
        }
      }

      // Convert session config to match Studio expectations (camelCase with Ms suffix)
      const sessionConfig = studioConfig.session ? {
        refreshBufferMs: studioConfig.session.refreshBuffer,
        warningBufferMs: studioConfig.session.warningBuffer,
        checkIntervalMs: studioConfig.session.checkInterval,
        inactivityTimeoutMs: studioConfig.session.inactivityTimeout,
      } : undefined

      const configWithMediaGenerator = {
        ...studioConfig,
        branding: mergedBranding,
        mediaUrlGenerator,
        media: studioConfig.media || { variants: [] }, // Include media variants for pre-flight checks
        sessionConfig, // Add session config for Studio's useAuth hook
      }

      this.logger.debug('Serving studio configuration', {
        title: mergedBranding.title,
        organizationName: mergedBranding.organizationName,
        enabled: studioConfig.enabled,
        hasMediaUrlGenerator: true,
        mediaVariantsCount: studioConfig.media?.variants?.length || 0,
        hasSessionConfig: !!sessionConfig
      })

      return this.successResponse({ studioConfig: configWithMediaGenerator })
    } catch (error) {
      this.logger.error('Failed to get studio config', {
        error: error instanceof Error ? error.message : String(error)
      })
      return this.errorResponse(error)
    }
  }

  /**
   * Get studio settings
   */
  private async getSettings(request: HttpRequest): Promise<HttpResponse> {
    try {
      await this.validateAuthentication(request)

      // Get settings from storage
      const dataStorage = this.core.getDataStorageAdapter()
      if (!dataStorage || !dataStorage.getSettings) {
        // Return default settings if storage doesn't support settings
        const defaultSettings = {
          publicUrl: 'http://localhost:3000',
          studioTitle: 'Trokky Studio',
          defaultTheme: 'system' as const
        }

        this.logger.debug('Returning default settings (storage not available)')
        return this.successResponse({ settings: defaultSettings })
      }

      let settings = await dataStorage.getSettings()

      if (!settings) {
        // Create default settings if none exist
        const defaultSettings = {
          id: 'studio-settings',
          publicUrl: 'http://localhost:3000',
          studioTitle: 'Trokky Studio',
          defaultTheme: 'system' as const,
          _createdAt: new Date().toISOString(),
          _updatedAt: new Date().toISOString()
        }

        // Save default settings if storage supports it
        if (dataStorage.saveSettings) {
          await dataStorage.saveSettings(defaultSettings)
        }
        settings = defaultSettings

        this.logger.info('Created default settings')
      }

      this.logger.debug('Serving settings', {
        publicUrl: settings.publicUrl,
        studioTitle: settings.studioTitle
      })

      return this.successResponse({ settings })
    } catch (error) {
      this.logger.error('Failed to get settings', {
        error: error instanceof Error ? error.message : String(error)
      })
      return this.errorResponse(error)
    }
  }

  /**
   * Update studio settings (admin only)
   */
  private async updateSettings(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and admin access
      await this.validateAuthentication(request)
      await this.validateAdminAccess(request)

      // SECURITY: Validate request body
      if (!request.body || typeof request.body !== 'object') {
        throw new InvalidInputError('Request body is required', 'body')
      }

      const body = request.body as Record<string, unknown>
      if (!('settings' in body) || !body.settings || typeof body.settings !== 'object') {
        throw new InvalidInputError('Settings data is required', 'settings')
      }

      const newSettings = body.settings as Record<string, any>

      // Field names only: settings are application-defined and routinely carry
      // credentials such as an SMTP password, which redaction cannot catch
      // under an arbitrary key name.
      this.logger.info('Received settings update', {
        settingsFields: Object.keys(newSettings)
      })

      // Get data storage
      const dataStorage = this.core.getDataStorageAdapter()

      // DEBUG: Check what methods are available
      this.logger.info('DEBUG: Data storage check', {
        hasDataStorage: !!dataStorage,
        hasGetSettings: !!dataStorage?.getSettings,
        hasSaveSettings: !!dataStorage?.saveSettings,
        adapterType: dataStorage?.constructor?.name
      })

      if (!dataStorage || !dataStorage.getSettings || !dataStorage.saveSettings) {
        return this.errorResponse(new Error('Settings storage not available'), 503)
      }

      // Get current settings
      let currentSettings = await dataStorage.getSettings()
      if (!currentSettings) {
        // Create new settings if none exist
        currentSettings = {
          id: 'studio-settings',
          publicUrl: 'http://localhost:3000',
          studioTitle: 'Trokky Studio',
          defaultTheme: 'system' as const,
          _createdAt: new Date().toISOString()
        }
      }

      // Get current user for audit trail
      const currentUser = await this.getCurrentUser(request)

      // Merge settings with metadata, ensuring required fields are present
      const updatedSettings: any = {
        id: 'studio-settings', // Ensure ID is consistent
        publicUrl: newSettings.publicUrl || currentSettings.publicUrl,
        studioTitle: newSettings.studioTitle || currentSettings.studioTitle,
        organizationName: newSettings.organizationName !== undefined ? newSettings.organizationName : currentSettings.organizationName,
        primaryColor: newSettings.primaryColor !== undefined ? newSettings.primaryColor : currentSettings.primaryColor,
        secondaryColor: newSettings.secondaryColor !== undefined ? newSettings.secondaryColor : currentSettings.secondaryColor,
        logo: newSettings.logo !== undefined ? newSettings.logo : currentSettings.logo,
        defaultTheme: newSettings.defaultTheme || currentSettings.defaultTheme,
        // MFA settings
        mfaRequired: newSettings.mfaRequired !== undefined ? newSettings.mfaRequired : currentSettings.mfaRequired,
        mfaEnforcedRoles: newSettings.mfaEnforcedRoles !== undefined ? newSettings.mfaEnforcedRoles : currentSettings.mfaEnforcedRoles,
        mfaAllowedMethods: newSettings.mfaAllowedMethods !== undefined ? newSettings.mfaAllowedMethods : currentSettings.mfaAllowedMethods,
        mfaTrustDeviceDays: newSettings.mfaTrustDeviceDays !== undefined ? newSettings.mfaTrustDeviceDays : currentSettings.mfaTrustDeviceDays,
        mfaGracePeriodDays: newSettings.mfaGracePeriodDays !== undefined ? newSettings.mfaGracePeriodDays : currentSettings.mfaGracePeriodDays,
        _createdAt: currentSettings._createdAt,
        _updatedAt: new Date().toISOString(),
        _updatedBy: currentUser?.username || 'system'
      }

      this.logger.info('Saving merged settings', {
        settingsFields: Object.keys(updatedSettings)
      })

      // Save to storage
      await dataStorage.saveSettings(updatedSettings)

      // Get event bus for emitting events
      const eventBus = this.core.getEventBus()
      if (eventBus) {
        // Emit general settings updated event
        await eventBus.emitEvent({
          type: 'settings.updated',
          data: {
            settings: updatedSettings,
            changes: newSettings,
            updatedBy: currentUser?.username || 'system'
          },
          source: 'api'
        })

        // Emit specific events for major changes
        if (newSettings.publicUrl && newSettings.publicUrl !== currentSettings.publicUrl) {
          await eventBus.emitEvent({
            type: 'settings.publicUrl.changed',
            data: {
              oldUrl: currentSettings.publicUrl,
              newUrl: newSettings.publicUrl,
              updatedBy: currentUser?.username || 'system'
            },
            source: 'api'
          })
        }

        if (newSettings.studioTitle && newSettings.studioTitle !== currentSettings.studioTitle) {
          await eventBus.emitEvent({
            type: 'settings.branding.changed',
            data: {
              oldTitle: currentSettings.studioTitle,
              newTitle: newSettings.studioTitle,
              updatedBy: currentUser?.username || 'system'
            },
            source: 'api'
          })
        }

        if (newSettings.defaultTheme && newSettings.defaultTheme !== currentSettings.defaultTheme) {
          await eventBus.emitEvent({
            type: 'settings.theme.changed',
            data: {
              oldTheme: currentSettings.defaultTheme,
              newTheme: newSettings.defaultTheme,
              updatedBy: currentUser?.username || 'system'
            },
            source: 'api'
          })
        }
      }

      this.logger.info('Settings updated', {
        changes: Object.keys(newSettings),
        updatedBy: currentUser?.username || 'system',
        eventsEmitted: !!eventBus
      })

      return this.successResponse({
        settings: updatedSettings,
        message: 'Settings updated successfully'
      })
    } catch (error) {
      this.logger.error('Failed to update settings', {
        error: error instanceof Error ? error.message : String(error)
      })
      return this.errorResponse(error)
    }
  }

  private async buildDefaultStructure(user: any, schemas: any[]): Promise<any> {
    const items: any[] = []

    // Create basic structure based on schemas and user permissions
    for (const schema of schemas) {
      if (!this.shouldIncludeSchemaInStructure(schema, user)) {
        continue
      }

      // A singleton schema must not be offered as a list: the Studio would show a Create
      // button whose save the server rejects once the one document exists.
      if (isSingletonSchema(schema)) {
        items.push({
          type: 'singleton',
          title: this.formatSchemaTitle(schema.name),
          schemaType: schema.name,
          documentId: schema.name,
          icon: this.getSchemaIcon(schema),
          options: { autoCreate: true }
        })
        continue
      }

      items.push({
        type: 'documentList',
        title: this.formatSchemaTitle(schema.name),
        schemaType: schema.name,
        icon: this.getSchemaIcon(schema),
        defaultOrdering: [{ field: '_updatedAt', direction: 'desc' }],
        options: {
          pageSize: 25,
          searchable: true,
          searchFields: this.getSearchableFields(schema)
        }
      })
    }

    // Add admin-only sections
    if (user?.role === 'admin') {
      items.push({
        type: 'divider',
        title: 'Administration'
      })

      // Add any admin-specific structure items here
    }

    return {
      title: 'Content Management',
      items,
      metadata: {
        version: '1.0.0',
        description: 'Dynamic structure generated from API endpoint',
        userId: user?.id,
        userRole: user?.role,
        generatedAt: new Date().toISOString()
      }
    }
  }

  private shouldIncludeSchemaInStructure(schema: any, user: any): boolean {
    // Basic permission check - extend as needed
    if (!user) return false

    // Admin can see everything
    if (user.role === 'admin') return true

    // Other users can see non-internal schemas
    return !schema.name.startsWith('_') && !schema.internal
  }

  private getSchemaIcon(schema: any): string {
    // Basic icon mapping based on schema name
    const name = schema.name.toLowerCase()

    if (name.includes('post') || name.includes('article')) return 'document-text'
    if (name.includes('page')) return 'document'
    if (name.includes('user') || name.includes('author')) return 'user'
    if (name.includes('category') || name.includes('tag')) return 'tag'
    if (name.includes('media') || name.includes('image')) return 'photo'
    if (name.includes('setting') || name.includes('config')) return 'cog'
    if (name.includes('menu') || name.includes('navigation')) return 'menu'

    return 'document-text'
  }
}
