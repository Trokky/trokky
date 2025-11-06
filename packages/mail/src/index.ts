/**
 * @trokky/mail - Core Mail Package
 *
 * Framework-agnostic mail layer with adapter pattern and templating.
 */

// Core types
export type {
  MailAdapter,
  MailMessage,
  MailAttachment,
  MailResult,
  MailBatchResult,
  TemplateRenderer,
  TemplateData,
  RenderedTemplate,
  BaseMailAdapterConfig,
  SMTPMailAdapterConfig,
  ResendMailAdapterConfig,
  GmailMailAdapterConfig,
  SESMailAdapterConfig,
  ConsoleMailAdapterConfig,
} from './types.js'

// Template system
export { BuiltInTemplateRenderer } from './templates/built-in-templates.js'
export type { BuiltInTemplateOptions } from './templates/built-in-templates.js'

// Mail service
export { MailService } from './mail-service.js'
export type {
  MailServiceConfig,
  SendPasswordResetOptions,
  SendPasswordChangedOptions,
  SendOTPOptions,
  SendSecurityAlertOptions,
  SendUserInviteOptions,
  SendWelcomeOptions,
  SendAccountApprovedOptions,
  SendAccountRejectedOptions,
} from './mail-service.js'

// Notification service
export { MailNotificationService } from './notification-service.js'
export type { MailNotificationConfig } from './notification-service.js'
