/**
 * @trokky/types - Mail Adapter Types
 *
 * Core interfaces and types for the Trokky mail layer.
 * Follows the adapter pattern for provider flexibility.
 */

// ============================================================================
// Mail Adapter Interface
// ============================================================================

/**
 * Main mail adapter interface that all providers must implement
 */
export interface MailAdapter {
  /**
   * Send a single email
   */
  send(message: MailMessage): Promise<MailResult>

  /**
   * Send multiple emails (batch operation)
   */
  sendBatch(messages: MailMessage[]): Promise<MailBatchResult>

  /**
   * Verify adapter configuration and connectivity
   */
  healthCheck(): Promise<boolean>

  /**
   * Get adapter name/type for logging and debugging
   */
  getAdapterName(): string
}

// ============================================================================
// Mail Message Types
// ============================================================================

/**
 * Email message structure
 */
export interface MailMessage {
  /** Sender email address */
  from: string
  /** Sender display name */
  fromName?: string
  /** Recipient email address(es) */
  to: string | string[]
  /** CC recipients */
  cc?: string | string[]
  /** BCC recipients */
  bcc?: string | string[]
  /** Email subject */
  subject: string
  /** Plain text body */
  text?: string
  /** HTML body */
  html?: string
  /** Reply-to address */
  replyTo?: string
  /** Email attachments */
  attachments?: MailAttachment[]
  /** Custom headers */
  headers?: Record<string, string>
  /** Provider-specific options */
  providerOptions?: Record<string, unknown>
}

/**
 * Email attachment
 */
export interface MailAttachment {
  /** Attachment filename */
  filename: string
  /** Content type (MIME type) */
  contentType: string
  /** File content (Buffer or base64 string) */
  content: Buffer | string
  /** Content encoding (base64, etc.) */
  encoding?: string
  /** Content ID for inline images */
  cid?: string
}

// ============================================================================
// Mail Result Types
// ============================================================================

/**
 * Result of sending a single email
 */
export interface MailResult {
  /** Whether the email was sent successfully */
  success: boolean
  /** Provider-specific message ID */
  messageId?: string
  /** Error message if failed */
  error?: string
  /** Provider-specific response data */
  providerData?: Record<string, unknown>
  /** Timestamp when email was sent */
  timestamp?: Date
}

/**
 * Result of sending multiple emails
 */
export interface MailBatchResult {
  /** Number of successful sends */
  successCount: number
  /** Number of failed sends */
  failureCount: number
  /** Individual results for each email */
  results: MailResult[]
  /** Total processing time in milliseconds */
  processingTime?: number
}

// ============================================================================
// Template Types
// ============================================================================

/**
 * Template data for variable substitution
 */
export interface TemplateData {
  [key: string]: unknown
}

/**
 * Rendered template result
 */
export interface RenderedTemplate {
  /** Email subject */
  subject: string
  /** HTML body */
  html?: string
  /** Plain text body */
  text?: string
  /** Override sender email */
  from?: string
  /** Override sender name */
  fromName?: string
}

/**
 * Template renderer interface
 */
export interface TemplateRenderer {
  /**
   * Render a template by ID with provided data
   */
  render(templateId: string, data: TemplateData): RenderedTemplate

  /**
   * Check if a template exists
   */
  hasTemplate(templateId: string): boolean

  /**
   * List all available template IDs
   */
  listTemplates(): string[]
}

// ============================================================================
// Adapter Configuration Types
// ============================================================================

/**
 * Base configuration for mail adapters
 */
export interface BaseMailAdapterConfig {
  /** Default sender email */
  from?: string
  /** Default sender name */
  fromName?: string
  /** Request timeout in milliseconds */
  timeout?: number
  /** Enable debug logging */
  debug?: boolean
}

/**
 * SMTP adapter configuration
 */
export interface SMTPMailAdapterConfig extends BaseMailAdapterConfig {
  /** SMTP server host */
  host: string
  /** SMTP server port */
  port: number
  /** Use secure connection (TLS) */
  secure: boolean
  /** Authentication credentials */
  auth: {
    user: string
    pass: string
  }
  /** Pool connections */
  pool?: boolean
  /** Max concurrent connections */
  maxConnections?: number
}

/**
 * Resend adapter configuration
 */
export interface ResendMailAdapterConfig extends BaseMailAdapterConfig {
  /** Resend API key */
  apiKey: string
  /** API base URL (for custom endpoints) */
  apiUrl?: string
}

/**
 * Gmail API adapter configuration
 */
export interface GmailMailAdapterConfig extends BaseMailAdapterConfig {
  /** OAuth2 client ID */
  clientId: string
  /** OAuth2 client secret */
  clientSecret: string
  /** OAuth2 refresh token */
  refreshToken: string
  /** User email (Gmail account) */
  user: string
}

/**
 * Amazon SES adapter configuration
 */
export interface SESMailAdapterConfig extends BaseMailAdapterConfig {
  /** AWS region */
  region: string
  /** AWS access key ID */
  accessKeyId: string
  /** AWS secret access key */
  secretAccessKey: string
  /** Configuration set name */
  configurationSetName?: string
}

/**
 * Console adapter configuration (for development)
 */
export interface ConsoleMailAdapterConfig extends BaseMailAdapterConfig {
  /** Log format: 'simple' | 'detailed' | 'json' */
  format?: 'simple' | 'detailed' | 'json'
  /** Include HTML in logs */
  includeHtml?: boolean
}
