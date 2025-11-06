/**
 * Resend Mail Adapter
 *
 * Production-ready mail adapter using Resend API.
 * https://resend.com
 */

import { Resend } from 'resend'
import { createLogger } from '@trokky/core'
import type {
  MailAdapter,
  MailMessage,
  MailResult,
  MailBatchResult,
  ResendMailAdapterConfig,
} from '@trokky/mail'

export class ResendMailAdapter implements MailAdapter {
  private resend: Resend
  private config: Required<ResendMailAdapterConfig>
  private logger = createLogger('mail', 'ResendMailAdapter')

  constructor(config: ResendMailAdapterConfig) {
    if (!config.apiKey) {
      throw new Error('Resend API key is required')
    }

    this.config = {
      apiKey: config.apiKey,
      apiUrl: config.apiUrl,
      from: config.from || 'noreply@example.com',
      fromName: config.fromName,
      timeout: config.timeout || 10000,
      debug: config.debug ?? false,
    }

    this.resend = new Resend(config.apiKey)

    if (this.config.debug) {
      this.logger.info('Resend mail adapter initialized', {
        from: this.config.from,
        hasApiUrl: !!this.config.apiUrl,
      })
    }
  }

  async send(message: MailMessage): Promise<MailResult> {
    try {
      const startTime = Date.now()

      // Convert attachments to Resend format
      const attachments = message.attachments?.map((att) => ({
        filename: att.filename,
        content: typeof att.content === 'string' ? Buffer.from(att.content, 'base64') : att.content,
      }))

      // Prepare Resend email data
      const emailData: any = {
        from: message.fromName ? `${message.fromName} <${message.from}>` : message.from,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        reply_to: message.replyTo,
        attachments,
        headers: message.headers,
      }

      // Add CC if provided
      if (message.cc) {
        emailData.cc = Array.isArray(message.cc) ? message.cc : [message.cc]
      }

      // Add BCC if provided
      if (message.bcc) {
        emailData.bcc = Array.isArray(message.bcc) ? message.bcc : [message.bcc]
      }

      const response = await this.resend.emails.send(emailData)

      const processingTime = Date.now() - startTime

      if (this.config.debug) {
        this.logger.info('Email sent via Resend', {
          to: message.to,
          subject: message.subject,
          messageId: response.data?.id,
          processingTime,
        })
      }

      if (response.error) {
        this.logger.error('Resend API error', response.error)
        return {
          success: false,
          error: response.error.message,
          providerData: response.error,
        }
      }

      return {
        success: true,
        messageId: response.data?.id,
        timestamp: new Date(),
        providerData: response.data,
      }
    } catch (error) {
      this.logger.error('Failed to send email via Resend', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        providerData: { error },
      }
    }
  }

  async sendBatch(messages: MailMessage[]): Promise<MailBatchResult> {
    const startTime = Date.now()
    const results: MailResult[] = []
    let successCount = 0
    let failureCount = 0

    // Resend doesn't have a native batch API, so we send sequentially
    // with some concurrency control
    const BATCH_SIZE = 5 // Send 5 emails concurrently

    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(batch.map((msg) => this.send(msg)))

      for (const result of batchResults) {
        results.push(result)
        if (result.success) {
          successCount++
        } else {
          failureCount++
        }
      }
    }

    const processingTime = Date.now() - startTime

    this.logger.info('Batch email completed', {
      total: messages.length,
      successCount,
      failureCount,
      processingTime,
    })

    return {
      successCount,
      failureCount,
      results,
      processingTime,
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Resend doesn't have a dedicated health check endpoint
      // We can verify the API key by making a minimal API call
      // For now, just verify we have an API key
      if (!this.config.apiKey) {
        return false
      }

      // TODO: Could add an actual API call to verify connection
      // For now, assume healthy if API key is present
      return true
    } catch (error) {
      this.logger.error('Resend health check failed', error)
      return false
    }
  }

  getAdapterName(): string {
    return 'resend'
  }
}
