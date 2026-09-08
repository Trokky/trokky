/**
 * Custom Template Renderer
 *
 * Allows full control over email templates with variable substitution.
 * Users can provide their own HTML/text templates for each email type.
 */

import type { TemplateRenderer, TemplateData, RenderedTemplate } from '../types.js'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Custom template definition
 */
export interface CustomTemplate {
  /**
   * Email subject with optional variables: {{variableName}}
   */
  subject: string

  /**
   * Full HTML template with optional variables: {{variableName}}
   * Receives all data passed to the template
   */
  html: string

  /**
   * Plain text template with optional variables: {{variableName}}
   * Receives all data passed to the template
   */
  text?: string
}

/**
 * Template function that receives data and returns a template
 * Useful for dynamic template generation
 */
export type CustomTemplateFunction = (data: TemplateData) => CustomTemplate

/**
 * Template definition - can be static or dynamic
 */
export type TemplateDefinition = CustomTemplate | CustomTemplateFunction

/**
 * Configuration for CustomTemplateRenderer
 */
export interface CustomTemplateRendererConfig {
  /**
   * Template definitions keyed by template ID
   */
  templates: Record<string, TemplateDefinition>

  /**
   * Fallback renderer for templates not defined in custom templates
   * If not provided, throws error for undefined templates
   */
  fallback?: TemplateRenderer

  /**
   * Custom variable delimiters (default: {{ and }})
   */
  delimiters?: {
    start: string
    end: string
  }
}

// =============================================================================
// BUILT-IN VARIABLE HELPERS
// =============================================================================

/**
 * Built-in helper functions available in templates
 */
const builtInHelpers: Record<string, (value: unknown) => string> = {
  /**
   * Format date to locale string
   */
  formatDate: (value: unknown): string => {
    if (value instanceof Date) {
      return value.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
    return String(value)
  },

  /**
   * Format date only (no time)
   */
  formatDateOnly: (value: unknown): string => {
    if (value instanceof Date) {
      return value.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }
    return String(value)
  },

  /**
   * Uppercase string
   */
  upper: (value: unknown): string => String(value).toUpperCase(),

  /**
   * Lowercase string
   */
  lower: (value: unknown): string => String(value).toLowerCase(),

  /**
   * Capitalize first letter
   */
  capitalize: (value: unknown): string => {
    const str = String(value)
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
  },
}

// =============================================================================
// CUSTOM TEMPLATE RENDERER
// =============================================================================

/**
 * Custom template renderer with full HTML/text control
 *
 * @example
 * ```typescript
 * const renderer = new CustomTemplateRenderer({
 *   templates: {
 *     'password-reset': {
 *       subject: 'Reset your password - {{brandName}}',
 *       html: '<h1>Hello {{firstName}}</h1><p>Click <a href="{{resetUrl}}">here</a></p>',
 *       text: 'Hello {{firstName}}, reset your password: {{resetUrl}}',
 *     },
 *   },
 * })
 * ```
 */
export class CustomTemplateRenderer implements TemplateRenderer {
  private templates: Record<string, TemplateDefinition>
  private fallback?: TemplateRenderer
  private startDelimiter: string
  private endDelimiter: string

  constructor(config: CustomTemplateRendererConfig) {
    this.templates = config.templates
    this.fallback = config.fallback
    this.startDelimiter = config.delimiters?.start ?? '{{'
    this.endDelimiter = config.delimiters?.end ?? '}}'
  }

  /**
   * Render a template with provided data
   */
  render(templateId: string, data: TemplateData): RenderedTemplate {
    const templateDef = this.templates[templateId]

    // If template not found, try fallback
    if (!templateDef) {
      if (this.fallback) {
        return this.fallback.render(templateId, data)
      }
      throw new Error(`Template not found: ${templateId}`)
    }

    // Get template (static or from function)
    const template =
      typeof templateDef === 'function' ? templateDef(data) : templateDef

    // Substitute variables
    const subject = this.substituteVariables(template.subject, data)
    const html = this.substituteVariables(template.html, data)
    const text = template.text
      ? this.substituteVariables(template.text, data)
      : undefined

    return { subject, html, text }
  }

  /**
   * Check if a template exists
   */
  hasTemplate(templateId: string): boolean {
    if (templateId in this.templates) {
      return true
    }
    if (this.fallback) {
      return this.fallback.hasTemplate(templateId)
    }
    return false
  }

  /**
   * List all available template IDs
   */
  listTemplates(): string[] {
    const customIds = Object.keys(this.templates)
    if (this.fallback) {
      const fallbackIds = this.fallback.listTemplates()
      return [...new Set([...customIds, ...fallbackIds])]
    }
    return customIds
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Substitute variables in a template string
   *
   * Supports:
   * - Simple variables: {{variableName}}
   * - Nested variables: {{user.firstName}}
   * - Helpers: {{formatDate:createdAt}}
   * - Default values: {{variableName|default}}
   */
  private substituteVariables(template: string, data: TemplateData): string {
    const regex = new RegExp(
      `${this.escapeRegex(this.startDelimiter)}\\s*([^}]+?)\\s*${this.escapeRegex(this.endDelimiter)}`,
      'g'
    )

    return template.replace(regex, (match, expression: string) => {
      return this.evaluateExpression(expression.trim(), data)
    })
  }

  /**
   * Evaluate a variable expression
   */
  private evaluateExpression(expression: string, data: TemplateData): string {
    // Check for default value: {{variable|default}}
    const [expr, defaultValue] = expression.split('|').map((s) => s.trim())

    // Check for helper: {{helper:variable}}
    if (expr.includes(':')) {
      const [helperName, variablePath] = expr.split(':').map((s) => s.trim())
      const helper = builtInHelpers[helperName]
      if (helper) {
        const value = this.getNestedValue(data, variablePath)
        return helper(value)
      }
    }

    // Get value from data
    const value = this.getNestedValue(data, expr)

    // Handle undefined/null
    if (value === undefined || value === null) {
      return defaultValue ?? ''
    }

    // Handle Date objects
    if (value instanceof Date) {
      return value.toISOString()
    }

    // Handle objects/arrays
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }

    return String(value)
  }

  /**
   * Get nested value from object using dot notation
   * e.g., "user.firstName" from { user: { firstName: "John" } }
   */
  private getNestedValue(obj: TemplateData, path: string): unknown {
    const keys = path.split('.')
    let current: unknown = obj

    for (const key of keys) {
      if (current === undefined || current === null) {
        return undefined
      }
      if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[key]
      } else {
        return undefined
      }
    }

    return current
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}
