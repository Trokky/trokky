/**
 * Mail Adapter Types
 *
 * Types are now centralized in @trokky/types and re-exported here for backwards compatibility.
 */

// Re-export all mail types from @trokky/types
export type {
  // Adapter interface
  MailAdapter,
  // Message types
  MailMessage,
  MailAttachment,
  // Result types
  MailResult,
  MailBatchResult,
  // Template types
  TemplateData,
  RenderedTemplate,
  TemplateRenderer,
  // Adapter configurations
  BaseMailAdapterConfig,
  SMTPMailAdapterConfig,
  ResendMailAdapterConfig,
  GmailMailAdapterConfig,
  SESMailAdapterConfig,
  ConsoleMailAdapterConfig
} from '../types/index.js'
