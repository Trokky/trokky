/**
 * Built-In Email Templates
 *
 * Professional, responsive email templates for common use cases.
 * Templates are defined as methods for type safety and flexibility.
 */

import type { TemplateRenderer, TemplateData, RenderedTemplate } from '../types.js'

export interface BuiltInTemplateOptions {
  /** Brand/application name */
  brandName: string
  /** Primary brand color (hex) */
  brandColor?: string
  /** Support email address */
  supportEmail?: string
  /** Base URL for links */
  baseUrl?: string
}

export class BuiltInTemplateRenderer implements TemplateRenderer {
  private readonly brandName: string
  private readonly brandColor: string
  private readonly supportEmail?: string
  private readonly baseUrl?: string

  constructor(options: BuiltInTemplateOptions) {
    this.brandName = options.brandName
    this.brandColor = options.brandColor || '#667eea'
    this.supportEmail = options.supportEmail
    this.baseUrl = options.baseUrl
  }

  render(templateId: string, data: TemplateData): RenderedTemplate {
    const method = this.templates[templateId]
    if (!method) {
      throw new Error(`Template not found: ${templateId}`)
    }
    return method.call(this, data)
  }

  hasTemplate(templateId: string): boolean {
    return templateId in this.templates
  }

  listTemplates(): string[] {
    return Object.keys(this.templates)
  }

  // Template registry mapping IDs to render methods
  private templates: Record<string, (data: TemplateData) => RenderedTemplate> = {
    'password-reset': this.renderPasswordReset.bind(this),
    'password-changed': this.renderPasswordChanged.bind(this),
    'user-invite': this.renderUserInvite.bind(this),
    'user-created': this.renderUserCreated.bind(this),
    'welcome': this.renderWelcome.bind(this),
    'otp-verification': this.renderOTPVerification.bind(this),
    'security-alert': this.renderSecurityAlert.bind(this),
    'account-approved': this.renderAccountApproved.bind(this),
    'account-rejected': this.renderAccountRejected.bind(this),
  }

  // ==========================================================================
  // TEMPLATE RENDERING METHODS
  // ==========================================================================

  private renderPasswordReset(data: TemplateData): RenderedTemplate {
    const { firstName, resetUrl, expiryMinutes = 60 } = data as {
      firstName: string
      resetUrl: string
      expiryMinutes?: number
    }

    return {
      subject: `Reset your password - ${this.brandName}`,
      html: this.wrapInLayout(`
        <h1>Password Reset Request</h1>
        <p>Hello ${this.escapeHtml(firstName)},</p>
        <p>You've requested to reset your password for your ${this.brandName} account.</p>

        <div style="background: white; border: 2px solid ${this.brandColor}; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
          <a href="${this.escapeHtml(resetUrl)}" style="background: ${this.brandColor}; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
        </div>

        <p style="color: #e74c3c; font-weight: bold;">⏰ This link will expire in ${expiryMinutes} minutes.</p>
        <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>

        <p style="font-size: 12px; color: #999; margin-top: 20px;">If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${this.escapeHtml(resetUrl)}" style="color: #667eea; word-break: break-all;">${this.escapeHtml(resetUrl)}</a></p>
      `),
      text: `
Password Reset Request

Hello ${firstName},

You've requested to reset your password for your ${this.brandName} account.

Reset your password here: ${resetUrl}

This link will expire in ${expiryMinutes} minutes.

If you didn't request this password reset, please ignore this email or contact support if you have concerns.
      `.trim(),
    }
  }

  private renderPasswordChanged(data: TemplateData): RenderedTemplate {
    const { firstName, changedAt } = data as {
      firstName: string
      changedAt: Date
    }

    return {
      subject: `Your password has been changed - ${this.brandName}`,
      html: this.wrapInLayout(`
        <h1>🔒 Password Changed</h1>
        <p>Hello ${this.escapeHtml(firstName)},</p>
        <p>Your password was successfully changed on ${changedAt.toLocaleString()}.</p>

        <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #155724;">✓ Your account is secure</p>
        </div>

        <p>If you didn't make this change, please contact support immediately${this.supportEmail ? ` at ${this.supportEmail}` : ''}.</p>
      `),
      text: `
Password Changed

Hello ${firstName},

Your password was successfully changed on ${changedAt.toLocaleString()}.

If you didn't make this change, please contact support immediately${this.supportEmail ? ` at ${this.supportEmail}` : ''}.
      `.trim(),
    }
  }

  private renderOTPVerification(data: TemplateData): RenderedTemplate {
    const { otpCode, expiryMinutes = 10, purpose = 'account verification' } = data as {
      otpCode: string
      expiryMinutes?: number
      purpose?: string
    }

    return {
      subject: `Your verification code for ${purpose}`,
      html: this.wrapInLayout(`
        <h1>Email Verification</h1>
        <p>You've requested to verify your email for <strong>${this.escapeHtml(purpose)}</strong>.</p>

        <div style="background: white; border: 2px dashed ${this.brandColor}; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Your verification code is:</p>
          <p style="font-size: 32px; font-weight: bold; color: ${this.brandColor}; letter-spacing: 8px; margin: 0;">${this.escapeHtml(otpCode)}</p>
        </div>

        <p style="color: #e74c3c; font-weight: bold;">⏰ This code will expire in ${expiryMinutes} minutes.</p>
        <p>If you didn't request this verification code, please ignore this email.</p>
      `),
      text: `
Email Verification

You've requested to verify your email for ${purpose}.

Your verification code is: ${otpCode}

This code will expire in ${expiryMinutes} minutes.

If you didn't request this verification code, please ignore this email.
      `.trim(),
    }
  }

  private renderSecurityAlert(data: TemplateData): RenderedTemplate {
    const { alertType, details, timestamp, actionRequired } = data as {
      alertType: string
      details: string
      timestamp: Date
      actionRequired?: string
    }

    return {
      subject: `Security Alert: ${alertType}`,
      html: this.wrapInLayout(`
        <h1>🔒 Security Alert</h1>
        <p>We detected the following security event on your account:</p>

        <div style="background: white; border-left: 4px solid #f5576c; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: #f5576c;">${this.escapeHtml(alertType)}</p>
          <p style="margin: 10px 0 0 0; color: #666;">${this.escapeHtml(details)}</p>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">Time: ${timestamp.toLocaleString()}</p>
        </div>

        ${actionRequired ? `
        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: #856404;">⚠️ Action Required:</p>
          <p style="margin: 10px 0 0 0; color: #856404;">${this.escapeHtml(actionRequired)}</p>
        </div>
        ` : ''}

        <p>If this wasn't you, please secure your account immediately and contact support.</p>
      `),
      text: `
Security Alert

We detected the following security event on your account:

${alertType}
${details}
Time: ${timestamp.toLocaleString()}

${actionRequired ? `Action Required: ${actionRequired}\n` : ''}
If this wasn't you, please secure your account immediately and contact support.
      `.trim(),
    }
  }

  private renderUserInvite(data: TemplateData): RenderedTemplate {
    const { inviterName, inviteUrl, expiresAt } = data as {
      inviterName: string
      inviteUrl: string
      expiresAt?: Date
    }

    return {
      subject: `You've been invited to ${this.brandName}`,
      html: this.wrapInLayout(`
        <h1>🎉 You're Invited!</h1>
        <p><strong>${this.escapeHtml(inviterName)}</strong> has invited you to join ${this.brandName}.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.escapeHtml(inviteUrl)}" style="background: ${this.brandColor}; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Accept Invitation</a>
        </div>

        ${expiresAt ? `<p style="color: #e74c3c;">⏰ This invitation expires on ${expiresAt.toLocaleDateString()}.</p>` : ''}

        <p style="font-size: 12px; color: #999; margin-top: 20px;">If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${this.escapeHtml(inviteUrl)}" style="color: #667eea; word-break: break-all;">${this.escapeHtml(inviteUrl)}</a></p>
      `),
      text: `
You're Invited!

${inviterName} has invited you to join ${this.brandName}.

Accept invitation: ${inviteUrl}

${expiresAt ? `This invitation expires on ${expiresAt.toLocaleDateString()}.` : ''}
      `.trim(),
    }
  }

  private renderUserCreated(data: TemplateData): RenderedTemplate {
    const { firstName, email, username, temporaryPassword, loginUrl } = data as {
      firstName: string
      email: string
      username: string
      temporaryPassword: string
      loginUrl?: string
    }

    return {
      subject: `Your ${this.brandName} account has been created`,
      html: this.wrapInLayout(`
        <h1>Welcome to ${this.brandName}! 🎉</h1>
        <p>Hello ${this.escapeHtml(firstName)},</p>
        <p>An administrator has created an account for you. Here are your login credentials:</p>

        <div style="background: #f8f9fa; border: 2px solid ${this.brandColor}; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <div style="margin-bottom: 15px;">
            <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Email</p>
            <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #333;">${this.escapeHtml(email)}</p>
          </div>
          <div style="margin-bottom: 15px;">
            <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Username</p>
            <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #333;">${this.escapeHtml(username)}</p>
          </div>
          <div>
            <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Temporary Password</p>
            <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: ${this.brandColor}; font-family: monospace;">${this.escapeHtml(temporaryPassword)}</p>
          </div>
        </div>

        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: #856404;">🔒 Security Recommendation:</p>
          <p style="margin: 10px 0 0 0; color: #856404;">Please change your password after your first login to ensure your account security.</p>
        </div>

        ${loginUrl ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.escapeHtml(loginUrl)}" style="background: ${this.brandColor}; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Log In Now</a>
        </div>
        ` : ''}

        <p>You can now:</p>
        <ul style="color: #666;">
          <li>Create and manage content</li>
          <li>Collaborate with your team</li>
          <li>Publish to your website</li>
        </ul>

        <p>If you have any questions, feel free to reach out to our support team${this.supportEmail ? ` at ${this.supportEmail}` : ''}.</p>

        ${loginUrl ? `
        <p style="font-size: 12px; color: #999; margin-top: 20px;">If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${this.escapeHtml(loginUrl)}" style="color: #667eea; word-break: break-all;">${this.escapeHtml(loginUrl)}</a></p>
        ` : ''}
      `),
      text: `
Welcome to ${this.brandName}!

Hello ${firstName},

An administrator has created an account for you. Here are your login credentials:

Email: ${email}
Username: ${username}
Temporary Password: ${temporaryPassword}

SECURITY RECOMMENDATION: Please change your password after your first login to ensure your account security.

${loginUrl ? `Log in here: ${loginUrl}\n` : ''}
You can now:
- Create and manage content
- Collaborate with your team
- Publish to your website

If you have any questions, feel free to reach out to our support team${this.supportEmail ? ` at ${this.supportEmail}` : ''}.
      `.trim(),
    }
  }

  private renderWelcome(data: TemplateData): RenderedTemplate {
    const { firstName } = data as { firstName: string }

    return {
      subject: `Welcome to ${this.brandName}!`,
      html: this.wrapInLayout(`
        <h1>Welcome ${this.escapeHtml(firstName)}! 🎉</h1>
        <p>Your account has been created successfully.</p>

        <p>You can now:</p>
        <ul style="color: #666;">
          <li>Create and manage content</li>
          <li>Collaborate with your team</li>
          <li>Publish to your website</li>
        </ul>

        <p>If you have any questions, feel free to reach out to our support team.</p>
      `),
      text: `
Welcome ${firstName}!

Your account has been created successfully.

You can now:
- Create and manage content
- Collaborate with your team
- Publish to your website

If you have any questions, feel free to reach out to our support team.
      `.trim(),
    }
  }

  private renderAccountApproved(data: TemplateData): RenderedTemplate {
    const { firstName, email } = data as { firstName: string; email: string }

    return {
      subject: 'Your account has been approved!',
      html: this.wrapInLayout(`
        <h1>🎉 Welcome ${this.escapeHtml(firstName)}!</h1>
        <p>Great news! Your account registration has been approved.</p>

        <div style="background: white; border: 2px solid ${this.brandColor}; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <p style="margin: 0; font-size: 14px; color: #666;">Account Email:</p>
          <p style="font-size: 18px; font-weight: bold; color: ${this.brandColor}; margin: 10px 0 0 0;">${this.escapeHtml(email)}</p>
        </div>

        <p>You can now log in and start using ${this.brandName}.</p>
      `),
      text: `
Welcome ${firstName}!

Great news! Your account registration has been approved.

Account Email: ${email}

You can now log in and start using ${this.brandName}.
      `.trim(),
    }
  }

  private renderAccountRejected(data: TemplateData): RenderedTemplate {
    const { reason, rejectedAt } = data as { reason: string; rejectedAt: Date }

    return {
      subject: 'Registration Request Update',
      html: this.wrapInLayout(`
        <h1>Registration Status Update</h1>
        <p>Thank you for your interest in ${this.brandName}. After reviewing your registration request, we are unable to approve your account at this time.</p>

        <div style="background: white; border-left: 4px solid #e74c3c; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: #e74c3c;">Registration Declined</p>
          <p style="margin: 10px 0 0 0; color: #666;">Reason: ${this.escapeHtml(reason)}</p>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">Declined at: ${rejectedAt.toLocaleString()}</p>
        </div>

        <p>If you believe this was in error or have questions, please contact our support team${this.supportEmail ? ` at ${this.supportEmail}` : ''}.</p>
      `),
      text: `
Registration Status Update

Thank you for your interest in ${this.brandName}. After reviewing your registration request, we are unable to approve your account at this time.

Reason: ${reason}
Declined at: ${rejectedAt.toLocaleString()}

If you believe this was in error or have questions, please contact our support team${this.supportEmail ? ` at ${this.supportEmail}` : ''}.
      `.trim(),
    }
  }

  // ==========================================================================
  // LAYOUT WRAPPER
  // ==========================================================================

  private wrapInLayout(content: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.brandName}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
  <div style="background: linear-gradient(135deg, ${this.brandColor} 0%, ${this.adjustColor(this.brandColor, -20)} 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${this.brandName}</h1>
  </div>

  <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    ${content}

    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

    <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
      This is an automated message from ${this.brandName}. Please do not reply to this email.
      ${this.supportEmail ? `<br>For support, contact <a href="mailto:${this.supportEmail}" style="color: ${this.brandColor};">${this.supportEmail}</a>` : ''}
    </p>
  </div>
</body>
</html>
    `.trim()
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Darken or lighten a hex color
   */
  private adjustColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16)
    const amt = Math.round(2.55 * percent)
    const R = Math.max(0, Math.min(255, (num >> 16) + amt))
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt))
    const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt))
    return '#' + ((R << 16) | (G << 8) | B).toString(16).padStart(6, '0')
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return text.replace(/[&<>"']/g, (char) => map[char])
  }
}
