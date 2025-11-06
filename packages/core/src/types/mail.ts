/**
 * Mail Configuration Types
 *
 * Types for the mail layer configuration in Trokky CMS.
 */

// =============================================================================
// MAIL CONFIGURATION
// =============================================================================

/**
 * Mail adapter configuration
 */
export interface MailConfig {
  /**
   * Mail adapter instance
   * Can be any object implementing the MailAdapter interface from @trokky/mail
   */
  adapter?: any // Will be typed as MailAdapter when @trokky/mail is built

  /**
   * Template configuration
   */
  templates?: {
    /** Brand/application name */
    brandName: string
    /** Primary brand color (hex) */
    brandColor?: string
    /** Support email address */
    supportEmail?: string
    /** Base URL for links in emails */
    baseUrl?: string
  }

  /**
   * Default sender configuration
   */
  from?: string
  fromName?: string

  /**
   * Notification settings
   */
  notifications?: {
    /** Send email on password reset request */
    passwordReset?: boolean
    /** Send email on password change */
    passwordChanged?: boolean
    /** Send email on user creation */
    userCreated?: boolean
    /** Send email on user invitation */
    userInvited?: boolean
    /** Send email on security alerts */
    securityAlerts?: boolean
  }

  /**
   * Enable debug logging
   */
  debug?: boolean
}

// =============================================================================
// PASSWORD RESET TYPES
// =============================================================================

/**
 * Password reset token data stored in user preferences
 */
export interface PasswordResetToken {
  /** Reset token (hashed) */
  token: string
  /** Token expiry timestamp */
  expiresAt: number
  /** When token was created */
  createdAt: number
  /** IP address that requested reset */
  ipAddress?: string
}

/**
 * Password reset request data
 */
export interface PasswordResetRequest {
  /** User email */
  email: string
  /** IP address of requester */
  ipAddress?: string
  /** User agent */
  userAgent?: string
}

/**
 * Password reset verification data
 */
export interface PasswordResetVerification {
  /** Reset token */
  token: string
  /** New password */
  newPassword: string
}
