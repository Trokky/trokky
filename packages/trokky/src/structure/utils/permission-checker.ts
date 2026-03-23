/**
 * Permission Checker
 * Utility for checking permissions against structure items
 */

import type { User } from '../../core/index.js'
import type {
  PermissionConfig,
  PermissionRule,
  PermissionCondition,
  PermissionFunction,
  PermissionContext,
  PermissionResult
} from '../types/index.js'
import { PermissionError, ErrorCodes, ErrorRecovery } from '../errors/index.js'

export interface PermissionCheckerOptions {
  /** Enable permission inheritance */
  enableInheritance?: boolean
  
  /** Default permissions for items without explicit permissions */
  defaultPermissions?: PermissionConfig
  
  /** Available roles in the system */
  availableRoles?: string[]
}

export class PermissionChecker {
  private defaultPermissions: PermissionConfig
  private availableRoles: Set<string>

  constructor(private options: PermissionCheckerOptions = {}) {
    this.defaultPermissions = options.defaultPermissions || {
      read: ['viewer', 'editor', 'admin'],
      create: ['editor', 'admin'],
      update: ['editor', 'admin'],
      delete: ['admin']
    }
    
    this.availableRoles = new Set(options.availableRoles || [
      'viewer', 'editor', 'admin'
    ])
  }

  /**
   * Check if user has permission for action
   */
  async check(
    permissions: PermissionConfig | undefined,
    action: string,
    user?: User,
    context?: PermissionContext
  ): Promise<boolean> {
    return ErrorRecovery.safeExecute(
      async () => {
        const result = await this.checkDetailed(permissions, action, user, context)
        return result.allowed
      },
      false, // Fallback to deny access on error
      (error: Error) => {
        console.warn('Permission check failed:', {
          action,
          user: user?.id,
          error: error.message
        })
      }
    )
  }

  /**
   * Check permissions with detailed result
   */
  async checkDetailed(
    permissions: PermissionConfig | undefined,
    action: string,
    user?: User,
    context?: PermissionContext
  ): Promise<PermissionResult> {
    // Use default permissions if none specified
    const effectivePermissions = permissions || this.defaultPermissions
    
    // Get rule for action
    const rule = effectivePermissions[action as keyof PermissionConfig] || 
                 effectivePermissions.custom?.[action]

    if (!rule) {
      return {
        allowed: false,
        reason: `No permission rule defined for action: ${action}`,
        rule
      }
    }

    return await this.evaluateRule(rule as PermissionRule, user, context)
  }

  /**
   * Evaluate a permission rule
   */
  private async evaluateRule(
    rule: PermissionRule,
    user?: User,
    context?: PermissionContext
  ): Promise<PermissionResult> {
    // Boolean rule
    if (typeof rule === 'boolean') {
      return {
        allowed: rule,
        reason: rule ? 'Explicitly allowed' : 'Explicitly denied',
        rule
      }
    }

    // No user for role-based checks
    if (!user && (typeof rule === 'string' || Array.isArray(rule))) {
      return {
        allowed: false,
        reason: 'Authentication required',
        rule
      }
    }

    // Single role string
    if (typeof rule === 'string') {
      const allowed = user?.role === rule
      return {
        allowed,
        reason: allowed ? `User has required role: ${rule}` : `User lacks required role: ${rule}`,
        rule
      }
    }

    // Multiple roles array
    if (Array.isArray(rule)) {
      const allowed = user?.role ? rule.includes(user.role) : false
      return {
        allowed,
        reason: allowed 
          ? `User role ${user?.role} is in allowed roles: [${rule.join(', ')}]`
          : `User role ${user?.role || 'none'} not in allowed roles: [${rule.join(', ')}]`,
        rule
      }
    }

    // Function rule
    if (typeof rule === 'function') {
      try {
        const result = rule(user!, context!)
        const allowed = result instanceof Promise ? await result : result
        return {
          allowed,
          reason: allowed ? 'Custom function allowed access' : 'Custom function denied access',
          rule
        }
      } catch (error: any) {
        throw new PermissionError(
          'Custom permission function failed',
          { rule, user: user?.id },
          error
        )
      }
    }

    // Conditional rule
    if (this.isConditionalRule(rule)) {
      return await this.evaluateConditionalRule(rule, user, context)
    }

    return {
      allowed: false,
      reason: 'Invalid permission rule',
      rule
    }
  }

  /**
   * Evaluate conditional permission rule
   */
  private async evaluateConditionalRule(
    rule: PermissionCondition,
    user?: User,
    context?: PermissionContext
  ): Promise<PermissionResult> {
    let conditionResult: boolean

    try {
      if (typeof rule.condition === 'string') {
        // String condition - could be evaluated as expression
        conditionResult = this.evaluateStringCondition(rule.condition, user, context)
      } else if (typeof rule.condition === 'function') {
        // Function condition
        conditionResult = rule.condition(user!, context!)
      } else {
        return {
          allowed: false,
          reason: 'Invalid condition type',
          rule
        }
      }
    } catch (error: any) {
      throw new PermissionError(
        'Permission condition evaluation failed',
        { rule, user: user?.id },
        error
      )
    }

    if (conditionResult) {
      // Condition is true - check allow rules
      if (rule.allow) {
        return await this.evaluateRule(rule.allow, user, context)
      }
      // No allow rule but condition is true - default allow
      return {
        allowed: true,
        reason: 'Condition met and no explicit allow rule',
        rule
      }
    } else {
      // Condition is false - check deny rules or fallback
      if (rule.deny) {
        const denyResult = await this.evaluateRule(rule.deny, user, context)
        return {
          allowed: !denyResult.allowed,
          reason: denyResult.allowed ? 'Explicitly denied by condition' : 'Not in deny list',
          rule
        }
      }
      
      // Check fallback rule
      if (rule.fallback) {
        return await this.evaluateRule(rule.fallback, user, context)
      }
      
      // No deny rule, no fallback - default deny
      return {
        allowed: false,
        reason: 'Condition not met and no fallback rule',
        rule
      }
    }
  }

  /**
   * Evaluate string condition
   */
  private evaluateStringCondition(
    condition: string,
    user?: User,
    context?: PermissionContext
  ): boolean {
    // Simple string conditions
    switch (condition) {
      case 'isAuthenticated':
        return !!user
      
      case 'isAdmin':
        return user?.role === 'admin'
      
      case 'isEditor':
        return user?.role === 'editor' || user?.role === 'admin'
      
      case 'isOwner':
        return context?.resource?.author === user?.id
      
      case 'isActive':
        return user?.isActive !== false
      
      default:
        // For more complex conditions, could implement expression parser
        console.warn(`Unknown string condition: ${condition}`)
        return false
    }
  }

  /**
   * Check if rule is conditional
   */
  private isConditionalRule(rule: any): rule is PermissionCondition {
    return rule && typeof rule === 'object' && 'condition' in rule
  }

  /**
   * Validate permission configuration
   */
  validatePermissionConfig(config: PermissionConfig): string[] {
    const errors: string[] = []

    for (const [action, rule] of Object.entries(config)) {
      const ruleErrors = this.validateRule(rule, `${action}`)
      errors.push(...ruleErrors)
    }

    return errors
  }

  /**
   * Validate permission rule
   */
  private validateRule(rule: PermissionRule, path: string): string[] {
    const errors: string[] = []

    if (typeof rule === 'boolean') {
      // Boolean rules are always valid
      return errors
    }

    if (typeof rule === 'string') {
      if (!this.availableRoles.has(rule)) {
        errors.push(`${path}: Unknown role "${rule}"`)
      }
      return errors
    }

    if (Array.isArray(rule)) {
      rule.forEach((role, index) => {
        if (typeof role !== 'string') {
          errors.push(`${path}[${index}]: Role must be string`)
        } else if (!this.availableRoles.has(role)) {
          errors.push(`${path}[${index}]: Unknown role "${role}"`)
        }
      })
      return errors
    }

    if (typeof rule === 'function') {
      // Functions are hard to validate statically
      return errors
    }

    if (this.isConditionalRule(rule)) {
      if (!rule.condition) {
        errors.push(`${path}: Conditional rule missing condition`)
      }
      
      if (rule.allow) {
        errors.push(...this.validateRule(rule.allow, `${path}.allow`))
      }
      
      if (rule.deny) {
        errors.push(...this.validateRule(rule.deny, `${path}.deny`))
      }
      
      if (rule.fallback) {
        errors.push(...this.validateRule(rule.fallback, `${path}.fallback`))
      }
      
      return errors
    }

    errors.push(`${path}: Invalid permission rule type`)
    return errors
  }

  /**
   * Get effective permissions for user
   */
  async getEffectivePermissions(
    permissions: PermissionConfig | undefined,
    user?: User,
    context?: PermissionContext
  ): Promise<Record<string, boolean>> {
    const effectivePermissions = permissions || this.defaultPermissions
    const result: Record<string, boolean> = {}

    // Check standard actions
    for (const action of ['read', 'create', 'update', 'delete']) {
      result[action] = await this.check(effectivePermissions, action, user, context)
    }

    // Check custom actions
    if (effectivePermissions.custom) {
      for (const action of Object.keys(effectivePermissions.custom)) {
        result[action] = await this.check(effectivePermissions, action, user, context)
      }
    }

    return result
  }
}