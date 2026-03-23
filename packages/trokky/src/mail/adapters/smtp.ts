/**
 * SMTP Mail Adapter
 *
 * Production-ready SMTP adapter using Nodemailer.
 * Supports standard SMTP servers, Gmail, Outlook, and more.
 */

import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { createLogger } from '../../core/index.js'
import type {
  MailAdapter,
  MailMessage,
  MailResult,
  MailBatchResult,
  SMTPMailAdapterConfig,
} from '../types.js'

export class SMTPMailAdapter implements MailAdapter {
  private transporter: Transporter
  private config: Required<SMTPMailAdapterConfig>
  private logger = createLogger('mail', 'SMTPMailAdapter')

  constructor(config: SMTPMailAdapterConfig) {
    if (!config.host || !config.port) {
      throw new Error('SMTP host and port are required')
    }

    if (!config.auth?.user || !config.auth?.pass) {
      throw new Error('SMTP authentication credentials are required')
    }

    this.config = {
      host: config.host,
      port: config.port,
      secure: config.secure ?? false,
      auth: config.auth,
      pool: config.pool ?? false,
      maxConnections: config.maxConnections ?? 5,
      from: config.from || 'noreply@example.com',
      fromName: config.fromName || '',
      timeout: config.timeout || 10000,
      debug: config.debug ?? false,
    }

    // Create Nodemailer transporter
    this.transporter = nodemailer.createTransport({
      // @ts-expect-error - nodemailer types are overly strict
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.auth.user,
        pass: this.config.auth.pass,
      },
      pool: this.config.pool,
      maxConnections: this.config.maxConnections,
      connectionTimeout: this.config.timeout,
    })

    if (this.config.debug) {
      this.logger.info('SMTP mail adapter initialized', {
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        pool: this.config.pool,
        from: this.config.from,
      })
    }
  }

  async send(message: MailMessage): Promise<MailResult> {
    try {
      const startTime = Date.now()

      // Convert attachments to Nodemailer format
      const attachments = message.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
        encoding: att.encoding,
        cid: att.cid,
      }))

      // Prepare Nodemailer email data
      const mailOptions: any = {
        from: message.fromName ? `"${message.fromName}" <${message.from}>` : message.from,
        to: message.to,
        cc: message.cc,
        bcc: message.bcc,
        subject: message.subject,
        text: message.text,
        html: message.html,
        replyTo: message.replyTo,
        attachments,
        headers: message.headers,
      }

      const info = await this.transporter.sendMail(mailOptions)

      const processingTime = Date.now() - startTime

      if (this.config.debug) {
        this.logger.info('Email sent via SMTP', {
          to: message.to,
          subject: message.subject,
          messageId: info.messageId,
          processingTime,
        })
      }

      return {
        success: true,
        messageId: info.messageId,
        timestamp: new Date(),
        providerData: {
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
        },
      }
    } catch (error) {
      this.logger.error('Failed to send email via SMTP', error)
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

    // If pooling is enabled, send concurrently
    // Otherwise send sequentially
    if (this.config.pool) {
      const batchResults = await Promise.all(messages.map((msg) => this.send(msg)))

      for (const result of batchResults) {
        results.push(result)
        if (result.success) {
          successCount++
        } else {
          failureCount++
        }
      }
    } else {
      // Send sequentially if not using connection pool
      for (const message of messages) {
        const result = await this.send(message)
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
      // Verify SMTP connection
      await this.transporter.verify()
      this.logger.debug('SMTP connection verified')
      return true
    } catch (error) {
      this.logger.error('SMTP health check failed', error)
      return false
    }
  }

  getAdapterName(): string {
    return 'smtp'
  }

  /**
   * Close the SMTP connection pool
   */
  async close(): Promise<void> {
    if (this.config.pool) {
      this.transporter.close()
      this.logger.debug('SMTP connection pool closed')
    }
  }
}
