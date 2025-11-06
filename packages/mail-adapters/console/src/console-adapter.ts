/**
 * Console Mail Adapter
 *
 * Development mail adapter that logs emails to console instead of sending them.
 * Useful for local development and testing.
 */

import { createLogger } from '@trokky/core'
import type {
  MailAdapter,
  MailMessage,
  MailResult,
  MailBatchResult,
  ConsoleMailAdapterConfig,
} from '@trokky/mail'

export class ConsoleMailAdapter implements MailAdapter {
  private config: Required<ConsoleMailAdapterConfig>
  private logger = createLogger('mail', 'ConsoleMailAdapter')
  private emailCount = 0

  constructor(config: ConsoleMailAdapterConfig = {}) {
    this.config = {
      from: config.from || 'noreply@example.com',
      fromName: config.fromName,
      timeout: config.timeout || 5000,
      debug: config.debug ?? true,
      format: config.format || 'detailed',
      includeHtml: config.includeHtml ?? false,
    }

    this.logger.info('Console mail adapter initialized', {
      format: this.config.format,
      includeHtml: this.config.includeHtml,
    })
  }

  async send(message: MailMessage): Promise<MailResult> {
    this.emailCount++
    const messageId = `console-${Date.now()}-${this.emailCount}`

    // Log based on format
    switch (this.config.format) {
      case 'simple':
        this.logSimple(message)
        break
      case 'json':
        this.logJson(message)
        break
      case 'detailed':
      default:
        this.logDetailed(message)
        break
    }

    return {
      success: true,
      messageId,
      timestamp: new Date(),
      providerData: {
        adapter: 'console',
        logged: true,
      },
    }
  }

  async sendBatch(messages: MailMessage[]): Promise<MailBatchResult> {
    const startTime = Date.now()
    const results: MailResult[] = []

    this.logger.info(`📧 Batch Email (${messages.length} messages)`, {
      separator: '='.repeat(80),
    })

    for (const message of messages) {
      const result = await this.send(message)
      results.push(result)
    }

    const processingTime = Date.now() - startTime

    this.logger.info(`✅ Batch completed in ${processingTime}ms`, {
      separator: '='.repeat(80),
    })

    return {
      successCount: messages.length,
      failureCount: 0,
      results,
      processingTime,
    }
  }

  async healthCheck(): Promise<boolean> {
    this.logger.debug('Console adapter health check: OK')
    return true
  }

  getAdapterName(): string {
    return 'console'
  }

  // ==========================================================================
  // LOGGING METHODS
  // ==========================================================================

  private logSimple(message: MailMessage): void {
    console.log(`📧 Email: ${message.subject}`)
    console.log(`   To: ${this.formatRecipients(message.to)}`)
    console.log(`   From: ${message.fromName || message.from}`)
    console.log('')
  }

  private logDetailed(message: MailMessage): void {
    console.log('')
    console.log('━'.repeat(80))
    console.log('📧  EMAIL MESSAGE')
    console.log('━'.repeat(80))
    console.log('')
    console.log(`Subject:     ${message.subject}`)
    console.log(`To:          ${this.formatRecipients(message.to)}`)
    console.log(`From:        ${message.fromName ? `${message.fromName} <${message.from}>` : message.from}`)

    if (message.cc) {
      console.log(`CC:          ${this.formatRecipients(message.cc)}`)
    }
    if (message.bcc) {
      console.log(`BCC:         ${this.formatRecipients(message.bcc)}`)
    }
    if (message.replyTo) {
      console.log(`Reply-To:    ${message.replyTo}`)
    }
    if (message.attachments && message.attachments.length > 0) {
      console.log(`Attachments: ${message.attachments.map((a) => a.filename).join(', ')}`)
    }

    console.log('')
    console.log('─'.repeat(80))
    console.log('TEXT CONTENT')
    console.log('─'.repeat(80))
    console.log(message.text || '(no text content)')
    console.log('')

    if (this.config.includeHtml && message.html) {
      console.log('─'.repeat(80))
      console.log('HTML CONTENT')
      console.log('─'.repeat(80))
      console.log(message.html)
      console.log('')
    }

    console.log('━'.repeat(80))
    console.log('')
  }

  private logJson(message: MailMessage): void {
    const output = {
      timestamp: new Date().toISOString(),
      subject: message.subject,
      to: message.to,
      from: message.from,
      fromName: message.fromName,
      cc: message.cc,
      bcc: message.bcc,
      replyTo: message.replyTo,
      text: message.text,
      html: this.config.includeHtml ? message.html : undefined,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        size: typeof a.content === 'string' ? a.content.length : a.content.length,
      })),
      headers: message.headers,
    }

    console.log(JSON.stringify(output, null, 2))
  }

  private formatRecipients(recipients: string | string[]): string {
    if (Array.isArray(recipients)) {
      return recipients.join(', ')
    }
    return recipients
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  /**
   * Get number of emails logged
   */
  getEmailCount(): number {
    return this.emailCount
  }

  /**
   * Reset email counter
   */
  resetCount(): void {
    this.emailCount = 0
  }
}
