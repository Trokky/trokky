/**
 * Mail Notification Service
 *
 * Event-driven email notification service for Trokky CMS.
 * Listens to system events and sends appropriate emails.
 */

import type { TrokkyEventBus, UserEvent, User, TrokkyCore } from '../core/index.js'
import { createLogger } from '../core/index.js'

import type { MailService } from './mail-service.js'

export interface MailNotificationConfig {
  /** Mail service instance */
  mailService: MailService

  /** Base URL for the application (used in email links) */
  baseUrl: string

  /** TrokkyCore instance for secure callback registration */
  core: TrokkyCore

  /** Notification settings */
  enabled?: {
    passwordReset?: boolean
    passwordChanged?: boolean
    userCreated?: boolean
    userInvited?: boolean
    securityAlerts?: boolean
    mfaOtp?: boolean
  }

  /** Enable debug logging */
  debug?: boolean
}

export class MailNotificationService {
  private mailService: MailService
  private eventBus: TrokkyEventBus
  private core: TrokkyCore
  private baseUrl: string
  private enabled: Required<NonNullable<MailNotificationConfig['enabled']>>
  private logger = createLogger('mail', 'MailNotificationService')
  private initialized = false

  constructor(eventBus: TrokkyEventBus, config: MailNotificationConfig) {
    this.eventBus = eventBus
    this.mailService = config.mailService
    this.core = config.core
    this.baseUrl = config.baseUrl

    // Default all notifications to enabled
    this.enabled = {
      passwordReset: config.enabled?.passwordReset ?? true,
      passwordChanged: config.enabled?.passwordChanged ?? true,
      userCreated: config.enabled?.userCreated ?? true,
      userInvited: config.enabled?.userInvited ?? true,
      securityAlerts: config.enabled?.securityAlerts ?? true,
      mfaOtp: config.enabled?.mfaOtp ?? true,
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

      // Register secure callback for user creation with passwords
      this.core.onUserCreatedWithPassword(async (user, temporaryPassword) => {
        if (!this.enabled.userCreated) return
        try {
          await this.sendUserCreatedEmail(user, temporaryPassword)
        } catch (error) {
          this.logger.error('Failed to send user created email', error)
        }
      })

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

    // User creation emails are handled via secure callback (registered in initialize())

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

    // Listen for MFA OTP requests
    this.eventBus.on('user.mfa_otp_requested', async (event: any) => {
      if (!this.enabled.mfaOtp) return

      try {
        const { email, otpCode, expiryMinutes, purpose } = event.data as {
          userId: string
          email: string
          firstName?: string
          otpCode: string
          expiryMinutes: number
          purpose: string
        }
        await this.sendMFAOTPEmail(email, otpCode, expiryMinutes, purpose)
      } catch (error) {
        this.logger.error('Failed to send MFA OTP email', error)
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
   * Send user created email with credentials
   */
  private async sendUserCreatedEmail(user: User, temporaryPassword: string): Promise<void> {
    this.logger.info('Sending user created email with credentials', {
      userId: user.id,
      email: user.email,
    })

    const loginUrl = `${this.baseUrl}/login`

    await this.mailService.sendUserCreated({
      user,
      temporaryPassword,
      loginUrl,
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
   * Send MFA OTP verification email
   */
  private async sendMFAOTPEmail(
    email: string,
    otpCode: string,
    expiryMinutes: number,
    purpose: string
  ): Promise<void> {
    this.logger.info('Sending MFA OTP email', {
      to: email,
      purpose,
    })

    await this.mailService.sendOTP({
      to: email,
      otpCode,
      expiryMinutes,
      purpose,
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
      mfaOtp: false,
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
      mfaOtp: true,
    }
    this.logger.info('All email notifications enabled')
  }
}
