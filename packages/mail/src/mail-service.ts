/**
 * Mail Service
 *
 * High-level email service that provides template rendering and
 * common email operations for the application.
 */

import type { User } from '@trokky/core'
import { createLogger } from '@trokky/core'
import type {
  MailAdapter,
  MailMessage,
  MailResult,
  MailBatchResult,
  TemplateRenderer,
  TemplateData,
} from './types.js'

// =============================================================================
// SERVICE CONFIGURATION
// =============================================================================

export interface MailServiceConfig {
  /** Mail adapter instance */
  adapter: MailAdapter
  /** Template renderer instance */
  templateRenderer: TemplateRenderer
  /** Default sender email */
  defaultFrom: string
  /** Default sender name */
  defaultFromName?: string
  /** Enable debug logging */
  debug?: boolean
}

// =============================================================================
// HIGH-LEVEL EMAIL OPTIONS
// =============================================================================

export interface SendPasswordResetOptions {
  /** User to send reset email to */
  user: User
  /** Password reset token */
  resetToken: string
  /** Full reset URL */
  resetUrl: string
  /** Token expiry in minutes */
  expiryMinutes?: number
}

export interface SendPasswordChangedOptions {
  /** User whose password was changed */
  user: User
  /** Timestamp of password change */
  changedAt?: Date
}

export interface SendOTPOptions {
  /** Recipient email address */
  to: string
  /** OTP code */
  otpCode: string
  /** OTP expiry in minutes */
  expiryMinutes?: number
  /** Purpose of OTP */
  purpose?: string
}

export interface SendSecurityAlertOptions {
  /** User to notify */
  user: User
  /** Type of security alert */
  alertType: string
  /** Alert details */
  details: string
  /** Timestamp of event */
  timestamp?: Date
  /** Action required message */
  actionRequired?: string
}

export interface SendUserInviteOptions {
  /** Email to send invitation to */
  to: string
  /** Name of person inviting */
  inviterName: string
  /** Invitation URL */
  inviteUrl: string
  /** Invitation expiry date */
  expiresAt?: Date
}

export interface SendWelcomeOptions {
  /** User to welcome */
  user: User
}

export interface SendAccountApprovedOptions {
  /** User whose account was approved */
  user: User
}

export interface SendAccountRejectedOptions {
  /** Email to notify */
  to: string
  /** Rejection reason */
  reason: string
  /** Rejection timestamp */
  rejectedAt?: Date
}

// =============================================================================
// MAIL SERVICE CLASS
// =============================================================================

export class MailService {
  private adapter: MailAdapter
  private templateRenderer: TemplateRenderer
  private defaultFrom: string
  private defaultFromName?: string
  private logger = createLogger('mail', 'MailService')
  private initialized: boolean = false

  constructor(config: MailServiceConfig) {
    this.adapter = config.adapter
    this.templateRenderer = config.templateRenderer
    this.defaultFrom = config.defaultFrom
    this.defaultFromName = config.defaultFromName

    if (config.debug) {
      this.logger.info('MailService initialized', {
        adapter: this.adapter.getAdapterName(),
        defaultFrom: this.defaultFrom,
        templates: this.templateRenderer.listTemplates(),
      })
    }
  }

  /**
   * Initialize the mail service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      const isHealthy = await this.adapter.healthCheck()

      if (!isHealthy) {
        this.logger.warn('Mail adapter health check failed', {
          adapter: this.adapter.getAdapterName(),
        })
      }

      this.initialized = true
      this.logger.info('Mail service initialized successfully', {
        adapter: this.adapter.getAdapterName(),
      })
    } catch (error) {
      this.logger.error('Failed to initialize mail service', error)
      throw error
    }
  }

  // ==========================================================================
  // HIGH-LEVEL EMAIL METHODS
  // ==========================================================================

  /**
   * Send password reset email
   */
  async sendPasswordReset(options: SendPasswordResetOptions): Promise<MailResult> {
    this.ensureInitialized()

    const template = this.templateRenderer.render('password-reset', {
      firstName: options.user.firstName,
      resetUrl: options.resetUrl,
      expiryMinutes: options.expiryMinutes || 60,
    })

    this.logger.info('Sending password reset email', {
      to: options.user.email,
      userId: options.user.id,
    })

    return this.adapter.send({
      from: this.defaultFrom,
      fromName: this.defaultFromName,
      to: options.user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  /**
   * Send password changed notification
   */
  async sendPasswordChanged(options: SendPasswordChangedOptions): Promise<MailResult> {
    this.ensureInitialized()

    const template = this.templateRenderer.render('password-changed', {
      firstName: options.user.firstName,
      changedAt: options.changedAt || new Date(),
    })

    this.logger.info('Sending password changed notification', {
      to: options.user.email,
      userId: options.user.id,
    })

    return this.adapter.send({
      from: this.defaultFrom,
      fromName: this.defaultFromName,
      to: options.user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  /**
   * Send OTP verification email
   */
  async sendOTP(options: SendOTPOptions): Promise<MailResult> {
    this.ensureInitialized()

    const template = this.templateRenderer.render('otp-verification', {
      otpCode: options.otpCode,
      expiryMinutes: options.expiryMinutes || 10,
      purpose: options.purpose || 'account verification',
    })

    this.logger.info('Sending OTP verification email', {
      to: options.to,
      purpose: options.purpose,
    })

    return this.adapter.send({
      from: this.defaultFrom,
      fromName: this.defaultFromName,
      to: options.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  /**
   * Send security alert email
   */
  async sendSecurityAlert(options: SendSecurityAlertOptions): Promise<MailResult> {
    this.ensureInitialized()

    const template = this.templateRenderer.render('security-alert', {
      alertType: options.alertType,
      details: options.details,
      timestamp: options.timestamp || new Date(),
      actionRequired: options.actionRequired,
    })

    this.logger.warn('Sending security alert email', {
      to: options.user.email,
      userId: options.user.id,
      alertType: options.alertType,
    })

    return this.adapter.send({
      from: this.defaultFrom,
      fromName: this.defaultFromName,
      to: options.user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  /**
   * Send user invitation email
   */
  async sendUserInvite(options: SendUserInviteOptions): Promise<MailResult> {
    this.ensureInitialized()

    const template = this.templateRenderer.render('user-invite', {
      inviterName: options.inviterName,
      inviteUrl: options.inviteUrl,
      expiresAt: options.expiresAt,
    })

    this.logger.info('Sending user invitation email', {
      to: options.to,
      inviterName: options.inviterName,
    })

    return this.adapter.send({
      from: this.defaultFrom,
      fromName: this.defaultFromName,
      to: options.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  /**
   * Send welcome email
   */
  async sendWelcome(options: SendWelcomeOptions): Promise<MailResult> {
    this.ensureInitialized()

    const template = this.templateRenderer.render('welcome', {
      firstName: options.user.firstName,
    })

    this.logger.info('Sending welcome email', {
      to: options.user.email,
      userId: options.user.id,
    })

    return this.adapter.send({
      from: this.defaultFrom,
      fromName: this.defaultFromName,
      to: options.user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  /**
   * Send account approved notification
   */
  async sendAccountApproved(options: SendAccountApprovedOptions): Promise<MailResult> {
    this.ensureInitialized()

    const template = this.templateRenderer.render('account-approved', {
      firstName: options.user.firstName,
      email: options.user.email,
    })

    this.logger.info('Sending account approved notification', {
      to: options.user.email,
      userId: options.user.id,
    })

    return this.adapter.send({
      from: this.defaultFrom,
      fromName: this.defaultFromName,
      to: options.user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  /**
   * Send account rejected notification
   */
  async sendAccountRejected(options: SendAccountRejectedOptions): Promise<MailResult> {
    this.ensureInitialized()

    const template = this.templateRenderer.render('account-rejected', {
      reason: options.reason,
      rejectedAt: options.rejectedAt || new Date(),
    })

    this.logger.info('Sending account rejected notification', {
      to: options.to,
      reason: options.reason,
    })

    return this.adapter.send({
      from: this.defaultFrom,
      fromName: this.defaultFromName,
      to: options.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  // ==========================================================================
  // GENERIC EMAIL METHODS
  // ==========================================================================

  /**
   * Send email using a template
   */
  async sendTemplate(
    templateId: string,
    to: string | string[],
    data: TemplateData
  ): Promise<MailResult> {
    this.ensureInitialized()

    if (!this.templateRenderer.hasTemplate(templateId)) {
      throw new Error(`Template not found: ${templateId}`)
    }

    const template = this.templateRenderer.render(templateId, data)

    this.logger.info('Sending templated email', {
      to,
      templateId,
    })

    return this.adapter.send({
      from: template.from || this.defaultFrom,
      fromName: template.fromName || this.defaultFromName,
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  /**
   * Send raw email message
   */
  async send(message: MailMessage): Promise<MailResult> {
    this.ensureInitialized()

    // Apply defaults if not provided
    const fullMessage: MailMessage = {
      ...message,
      from: message.from || this.defaultFrom,
      fromName: message.fromName || this.defaultFromName,
    }

    this.logger.info('Sending email', {
      to: fullMessage.to,
      subject: fullMessage.subject,
    })

    return this.adapter.send(fullMessage)
  }

  /**
   * Send batch emails
   */
  async sendBatch(messages: MailMessage[]): Promise<MailBatchResult> {
    this.ensureInitialized()

    // Apply defaults to all messages
    const fullMessages = messages.map((message) => ({
      ...message,
      from: message.from || this.defaultFrom,
      fromName: message.fromName || this.defaultFromName,
    }))

    this.logger.info('Sending batch emails', {
      count: fullMessages.length,
    })

    return this.adapter.sendBatch(fullMessages)
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Verify email service is working
   */
  async healthCheck(): Promise<boolean> {
    return this.adapter.healthCheck()
  }

  /**
   * Get adapter name
   */
  getAdapterName(): string {
    return this.adapter.getAdapterName()
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): string[] {
    return this.templateRenderer.listTemplates()
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Mail service not initialized. Call initialize() first.')
    }
  }
}
