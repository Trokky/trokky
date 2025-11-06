/**
 * Mail Notification Service
 *
 * Event-driven email notification service for Trokky CMS.
 * Listens to system events and sends appropriate emails.
 */

import type { TrokkyEventBus, UserEvent, User } from '@trokky/core'
import { createLogger } from '@trokky/core'

// Import mail service types (will be available once @trokky/mail is built)
type MailService = any // Will be properly typed when @trokky/mail is available

export interface MailNotificationConfig {
  /** Mail service instance */
  mailService: MailService

  /** Base URL for the application (used in email links) */
  baseUrl: string

  /** Notification settings */
  enabled?: {
    passwordReset?: boolean
    passwordChanged?: boolean
    userCreated?: boolean
    userInvited?: boolean
    securityAlerts?: boolean
  }

  /** Enable debug logging */
  debug?: boolean
}

export class MailNotificationService {
  private mailService: MailService
  private eventBus: TrokkyEventBus
  private baseUrl: string
  private enabled: Required<NonNullable<MailNotificationConfig['enabled']>>
  private logger = createLogger('mail', 'MailNotificationService')
  private initialized = false

  constructor(eventBus: TrokkyEventBus, config: MailNotificationConfig) {
    this.eventBus = eventBus
    this.mailService = config.mailService
    this.baseUrl = config.baseUrl

    // Default all notifications to enabled
    this.enabled = {
      passwordReset: config.enabled?.passwordReset ?? true,
      passwordChanged: config.enabled?.passwordChanged ?? true,
      userCreated: config.enabled?.userCreated ?? true,
      userInvited: config.enabled?.userInvited ?? true,
      securityAlerts: config.enabled?.securityAlerts ?? true,
    }

    if (config.debug) {
      this.logger.info('Mail notification service configured', {
        baseUrl: this.baseUrl,
        enabled: this.enabled,
      })
    }
  }

  /**
   * Initialize the notification service and setup event listeners
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // Setup event listeners
      this.setupEventListeners()

      this.initialized = true
      this.logger.info('Mail notification service initialized')
    } catch (error) {
      this.logger.error('Failed to initialize mail notification service', error)
      throw error
    }
  }

  /**
   * Setup event listeners for various user events
   */
  private setupEventListeners(): void {
    // Listen for password reset requests
    this.eventBus.on('user.password_reset_requested', async (event: UserEvent) => {
      if (!this.enabled.passwordReset) return

      try {
        const { user, resetToken } = event.data as { user: User; resetToken: string }
        await this.sendPasswordResetEmail(user, resetToken)
      } catch (error) {
        this.logger.error('Failed to send password reset email', error)
      }
    })

    // Listen for password changes
    this.eventBus.on('user.password_changed', async (event: UserEvent) => {
      if (!this.enabled.passwordChanged) return

      try {
        const { user } = event.data as { user: User }
        await this.sendPasswordChangedEmail(user)
      } catch (error) {
        this.logger.error('Failed to send password changed email', error)
      }
    })

    // Listen for user creation
    this.eventBus.on('user.created', async (event: UserEvent) => {
      if (!this.enabled.userCreated) return

      try {
        const { user } = event.data as { user: User }
        await this.sendWelcomeEmail(user)
      } catch (error) {
        this.logger.error('Failed to send welcome email', error)
      }
    })

    // Listen for user invitations
    this.eventBus.on('user.invited', async (event: UserEvent) => {
      if (!this.enabled.userInvited) return

      try {
        const { email, inviterName, inviteToken } = event.data as {
          email: string
          inviterName: string
          inviteToken: string
        }
        await this.sendUserInviteEmail(email, inviterName, inviteToken)
      } catch (error) {
        this.logger.error('Failed to send user invite email', error)
      }
    })

    // Listen for security alerts
    this.eventBus.on('security.alert', async (event: any) => {
      if (!this.enabled.securityAlerts) return

      try {
        const { user, alertType, details, actionRequired } = event.data as {
          user: User
          alertType: string
          details: string
          actionRequired?: string
        }
        await this.sendSecurityAlertEmail(user, alertType, details, actionRequired)
      } catch (error) {
        this.logger.error('Failed to send security alert email', error)
      }
    })

    this.logger.debug('Event listeners setup complete')
  }

  // ==========================================================================
  // EMAIL SENDING METHODS
  // ==========================================================================

  /**
   * Send password reset email
   */
  private async sendPasswordResetEmail(user: User, resetToken: string): Promise<void> {
    const resetUrl = `${this.baseUrl}/reset-password?token=${resetToken}`

    this.logger.info('Sending password reset email', {
      userId: user.id,
      email: user.email,
    })

    await this.mailService.sendPasswordReset({
      user,
      resetToken,
      resetUrl,
      expiryMinutes: 60,
    })
  }

  /**
   * Send password changed notification
   */
  private async sendPasswordChangedEmail(user: User): Promise<void> {
    this.logger.info('Sending password changed email', {
      userId: user.id,
      email: user.email,
    })

    await this.mailService.sendPasswordChanged({
      user,
      changedAt: new Date(),
    })
  }

  /**
   * Send welcome email to new user
   */
  private async sendWelcomeEmail(user: User): Promise<void> {
    this.logger.info('Sending welcome email', {
      userId: user.id,
      email: user.email,
    })

    await this.mailService.sendWelcome({
      user,
    })
  }

  /**
   * Send user invitation email
   */
  private async sendUserInviteEmail(
    email: string,
    inviterName: string,
    inviteToken: string
  ): Promise<void> {
    const inviteUrl = `${this.baseUrl}/accept-invite?token=${inviteToken}`

    this.logger.info('Sending user invite email', {
      to: email,
      inviterName,
    })

    await this.mailService.sendUserInvite({
      to: email,
      inviterName,
      inviteUrl,
    })
  }

  /**
   * Send security alert email
   */
  private async sendSecurityAlertEmail(
    user: User,
    alertType: string,
    details: string,
    actionRequired?: string
  ): Promise<void> {
    this.logger.warn('Sending security alert email', {
      userId: user.id,
      email: user.email,
      alertType,
    })

    await this.mailService.sendSecurityAlert({
      user,
      alertType,
      details,
      timestamp: new Date(),
      actionRequired,
    })
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Disable all notifications temporarily
   */
  disableAll(): void {
    this.enabled = {
      passwordReset: false,
      passwordChanged: false,
      userCreated: false,
      userInvited: false,
      securityAlerts: false,
    }
    this.logger.warn('All email notifications disabled')
  }

  /**
   * Enable all notifications
   */
  enableAll(): void {
    this.enabled = {
      passwordReset: true,
      passwordChanged: true,
      userCreated: true,
      userInvited: true,
      securityAlerts: true,
    }
    this.logger.info('All email notifications enabled')
  }
}
