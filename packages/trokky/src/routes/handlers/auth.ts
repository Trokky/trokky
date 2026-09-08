/**
 * AuthRoutes - Authentication, OAuth, passkey, MFA and OAuth2 server route handlers
 */

import { SecurityValidator, InvalidInputError } from '../../core/index.js'
import type { HttpRequest, HttpResponse, RouteDefinition, LoginRequest, LoginResponse } from '../types.js'
import { BaseRoutes } from './base.js'

export class AuthRoutes extends BaseRoutes {
  public getRoutes(): RouteDefinition[] {
    const basePath = this.config.basePath || ''
    return this.defineRoutes([
      ['POST', `${basePath}/auth/login`, this.login.bind(this)],
      ['POST', `${basePath}/auth/logout`, this.logout.bind(this)],
      ['GET', `${basePath}/auth/me`, this.getMe.bind(this)],
      ['POST', `${basePath}/auth/validate`, this.validateToken.bind(this)],
      ['POST', `${basePath}/auth/refresh`, this.refreshToken.bind(this)],
      ['POST', `${basePath}/auth/request-reset`, this.requestPasswordReset.bind(this)],
      ['POST', `${basePath}/auth/reset-password`, this.resetPassword.bind(this)],
      ['POST', `${basePath}/auth/verify-reset-token`, this.verifyResetToken.bind(this)],
      ['POST', `${basePath}/auth/change-password`, this.changePassword.bind(this)],
      ['POST', `${basePath}/auth/oauth/google/init`, this.initGoogleOAuth.bind(this)],
      ['POST', `${basePath}/auth/oauth/google/callback`, this.handleGoogleOAuthCallback.bind(this)],
      ['DELETE', `${basePath}/auth/oauth/google/unlink`, this.unlinkGoogleAccount.bind(this)],
      ['GET', `${basePath}/auth/oauth/status`, this.getOAuthStatus.bind(this)],
      ['GET', `${basePath}/auth/passkey/status`, this.getPasskeyStatus.bind(this)],
      ['POST', `${basePath}/auth/passkey/register/options`, this.getPasskeyRegistrationOptions.bind(this)],
      ['POST', `${basePath}/auth/passkey/register/verify`, this.verifyPasskeyRegistration.bind(this)],
      ['POST', `${basePath}/auth/passkey/login/options`, this.getPasskeyLoginOptions.bind(this)],
      ['POST', `${basePath}/auth/passkey/login/verify`, this.verifyPasskeyLogin.bind(this)],
      ['GET', `${basePath}/auth/passkey/credentials`, this.listPasskeyCredentials.bind(this)],
      ['PATCH', `${basePath}/auth/passkey/credentials/:credentialId`, this.updatePasskeyCredential.bind(this)],
      ['DELETE', `${basePath}/auth/passkey/credentials/:credentialId`, this.deletePasskeyCredential.bind(this)],
      ['GET', `${basePath}/auth/captcha/status`, this.getCaptchaStatus.bind(this)],
      ['POST', `${basePath}/auth/mfa/verify`, this.verifyMFA.bind(this)],
      ['POST', `${basePath}/auth/mfa/verify-backup`, this.verifyMFABackup.bind(this)],
      ['POST', `${basePath}/auth/mfa/send-code`, this.sendMFACode.bind(this)],
      ['POST', `${basePath}/auth/mfa/setup/totp`, this.initTOTPSetup.bind(this)],
      ['POST', `${basePath}/auth/mfa/setup/totp/verify`, this.verifyTOTPSetup.bind(this)],
      ['POST', `${basePath}/auth/mfa/setup/email`, this.initEmailOTPSetup.bind(this)],
      ['POST', `${basePath}/auth/mfa/setup/email/verify`, this.verifyEmailOTPSetup.bind(this)],
      ['POST', `${basePath}/auth/mfa/disable`, this.disableMFA.bind(this)],
      ['POST', `${basePath}/auth/mfa/disable-all`, this.disableAllMFA.bind(this)],
      ['POST', `${basePath}/auth/mfa/backup-codes/regenerate`, this.regenerateBackupCodes.bind(this)],
      ['GET', `${basePath}/auth/mfa/status`, this.getMFAStatus.bind(this)],
      ['GET', `${basePath}/auth/mfa/trusted-devices`, this.getTrustedDevices.bind(this)],
      ['DELETE', `${basePath}/auth/mfa/trusted-devices/:deviceId`, this.revokeTrustedDevice.bind(this)],
      ['DELETE', `${basePath}/auth/mfa/trusted-devices`, this.revokeAllTrustedDevices.bind(this)],
      ['POST', `${basePath}/admin/users/:userId/mfa/reset`, this.adminResetUserMFA.bind(this)],
      ['POST', `${basePath}/auth/device`, this.startDeviceAuthorization.bind(this)],
      ['GET', `${basePath}/auth/device/verify`, this.getDeviceCodeInfo.bind(this)],
      ['POST', `${basePath}/auth/device/verify`, this.verifyDeviceCode.bind(this)],
      ['POST', `${basePath}/auth/token`, this.handleOAuth2TokenRequest.bind(this)],
      ['GET', `${basePath}/auth/authorize`, this.validateAuthorizationRequest.bind(this)],
      ['POST', `${basePath}/auth/authorize`, this.handleAuthorizationDecision.bind(this)]
    ])
  }

  // Authentication handlers
  private async login(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate request body structure
      if (!request.body || typeof request.body !== 'object') {
        throw new InvalidInputError('Request body is required', 'body')
      }

      const body = request.body as LoginRequest
      
      // Validate required fields
      if (!body.username || !body.password) {
        throw new InvalidInputError('Username and password are required', 'body')
      }

      SecurityValidator.validateUsername(body.username)

      // Validate CAPTCHA if required
      const { validateCaptcha, getClientIp } = await import('../auth/captcha.js')
      await validateCaptcha(this.core, body.captchaToken, getClientIp(request), 'login')

      // Use core engine's authentication method (handles all validation internally)
      const authResult = await this.core.authenticateUser(body.username, body.password, {
        rememberMe: body.rememberMe,
        deviceId: body.deviceId
      })
      if (!authResult) {
        throw new InvalidInputError('Invalid credentials', 'credentials')
      }

      // Handle different authentication result types
      if (authResult.type === 'mfa_required') {
        // User has MFA configured - need to verify
        return this.successResponse({
          success: true,
          requiresMFA: true,
          mfaToken: authResult.mfaToken,
          methods: authResult.methods,
          expiresIn: authResult.expiresIn
        })
      }

      if (authResult.type === 'mfa_setup_required') {
        // Organization requires MFA but user hasn't set it up
        return this.successResponse({
          success: true,
          requiresMFASetup: true,
          setupToken: authResult.setupToken,
          allowedMethods: authResult.allowedMethods,
          message: authResult.message,
          expiresIn: authResult.expiresIn
        })
      }

      // Normal successful authentication (type: 'success')
      const { user: authenticatedUser, token, refreshToken } = authResult

      // Get token expiration time
      const session = await this.core.verifyAuthToken(token)

      const response: LoginResponse = {
        success: true,
        token,
        refreshToken,
        user: authenticatedUser,
        expiresAt: session?.expiresAt
      }

      return this.successResponse(response)
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async logout(request: HttpRequest): Promise<HttpResponse> {
    try {
      // For now, logout is client-side token removal
      // In a full implementation, we'd invalidate the token server-side
      return this.successResponse({ message: 'Logged out successfully' })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async getMe(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and get current user session
      await this.validateAuthentication(request)
      const sessionUser = await this.getCurrentUser(request)
      
      if (!sessionUser) {
        throw new Error('User session not found')
      }
      
      // Fetch full user data from storage using the user ID from session
      const fullUser = await this.core.getUser(sessionUser.id)
      
      if (!fullUser) {
        throw new Error('User not found in database')
      }
      
      // Remove password hash from response for security
      const { passwordHash, ...safeUser } = fullUser
      
      return this.successResponse(safeUser)
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async validateToken(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate request body structure
      if (!request.body || typeof request.body !== 'object') {
        throw new InvalidInputError('Request body is required', 'body')
      }

      const body = request.body as Record<string, unknown>
      if (!('token' in body) || !body.token || typeof body.token !== 'string') {
        throw new InvalidInputError('Token is required', 'token')
      }

      const { token } = body as { token: string }

      // Validate token using core engine's JWT verification
      const session = await this.core.verifyAuthToken(token)
      const isValid = session !== null
      
      return this.successResponse({ 
        valid: isValid,
        message: isValid ? 'Token is valid' : 'Token is invalid',
        session: isValid ? session : undefined
      })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  // Authentication Routes
  private async refreshToken(request: HttpRequest): Promise<HttpResponse> {
    try {
      if (!request.body || typeof request.body !== 'object') {
        return this.errorResponse(new InvalidInputError('Request body is required'))
      }

      const body = request.body as Record<string, unknown>
      const { refreshToken } = body
      
      if (!refreshToken) {
        return this.errorResponse(new InvalidInputError('Refresh token is required'))
      }

      // TODO: Core method exists but may not be implemented yet
      const result = await this.core.refreshAuthToken(refreshToken as string)
      if (!result) {
        return this.errorResponse(new Error('Invalid or expired refresh token'), 401)
      }
      return this.successResponse(result)
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  /**
   * Request password reset
   * POST /auth/request-reset
   */
  private async requestPasswordReset(request: HttpRequest): Promise<HttpResponse> {
    // Import password reset handler dynamically
    const { requestPasswordReset: handler } = await import('../auth/password-reset.js')
    return handler(request, this.core)
  }

  /**
   * Reset password with token
   * POST /auth/reset-password
   */
  private async resetPassword(request: HttpRequest): Promise<HttpResponse> {
    // Import password reset handler dynamically
    const { resetPassword: handler } = await import('../auth/password-reset.js')
    return handler(request, this.core)
  }

  /**
   * Verify reset token validity
   * POST /auth/verify-reset-token
   */
  private async verifyResetToken(request: HttpRequest): Promise<HttpResponse> {
    // Import password reset handler dynamically
    const { verifyResetToken: handler } = await import('../auth/password-reset.js')
    return handler(request, this.core)
  }

  /**
   * Change password (authenticated users)
   * POST /auth/change-password
   */
  private async changePassword(request: HttpRequest): Promise<HttpResponse> {
    // SECURITY: Validate authentication and populate request.user
    await this.validateAuthentication(request)

    // Import change password handler dynamically
    const { changePassword: handler } = await import('../auth/change-password.js')
    return handler(request, this.core)
  }

  /**
   * Initialize Google OAuth flow
   * POST /auth/oauth/google/init
   */
  private async initGoogleOAuth(request: HttpRequest): Promise<HttpResponse> {
    // For link mode, validate authentication
    const body = request.body as { mode?: string }
    if (body?.mode === 'link') {
      await this.validateAuthentication(request)
    }

    const { initGoogleOAuth: handler } = await import('../auth/oauth.js')
    return handler(this.core, request)
  }

  /**
   * Handle Google OAuth callback
   * POST /auth/oauth/google/callback
   */
  private async handleGoogleOAuthCallback(request: HttpRequest): Promise<HttpResponse> {
    // For link mode, validate authentication
    const body = request.body as { mode?: string }
    if (body?.mode === 'link') {
      try {
        await this.validateAuthentication(request)
      } catch {
        // Ignore auth errors for link mode - the handler will check
      }
    }

    const { handleGoogleOAuthCallback: handler } = await import('../auth/oauth.js')
    return handler(this.core, request)
  }

  /**
   * Unlink Google account
   * DELETE /auth/oauth/google/unlink
   */
  private async unlinkGoogleAccount(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { unlinkGoogleAccount: handler } = await import('../auth/oauth.js')
    return handler(this.core, request)
  }

  /**
   * Get OAuth status
   * GET /auth/oauth/status
   */
  private async getOAuthStatus(request: HttpRequest): Promise<HttpResponse> {
    const { getOAuthStatus: handler } = await import('../auth/oauth.js')
    return handler(this.core, request)
  }

  /**
   * Get passkey status
   * GET /auth/passkey/status
   */
  private async getPasskeyStatus(request: HttpRequest): Promise<HttpResponse> {
    const { getPasskeyStatus: handler } = await import('../auth/passkey.js')
    return handler(this.core, request)
  }

  /**
   * Get passkey registration options
   * POST /auth/passkey/register/options
   */
  private async getPasskeyRegistrationOptions(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { getPasskeyRegistrationOptions: handler } = await import('../auth/passkey.js')
    return handler(this.core, request)
  }

  /**
   * Verify passkey registration
   * POST /auth/passkey/register/verify
   */
  private async verifyPasskeyRegistration(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { verifyPasskeyRegistration: handler } = await import('../auth/passkey.js')
    return handler(this.core, request)
  }

  /**
   * Get passkey login options
   * POST /auth/passkey/login/options
   */
  private async getPasskeyLoginOptions(request: HttpRequest): Promise<HttpResponse> {
    const { getPasskeyAuthenticationOptions: handler } = await import('../auth/passkey.js')
    return handler(this.core, request)
  }

  /**
   * Verify passkey login
   * POST /auth/passkey/login/verify
   */
  private async verifyPasskeyLogin(request: HttpRequest): Promise<HttpResponse> {
    const { verifyPasskeyAuthentication: handler } = await import('../auth/passkey.js')
    return handler(this.core, request)
  }

  /**
   * List passkey credentials
   * GET /auth/passkey/credentials
   */
  private async listPasskeyCredentials(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { listPasskeyCredentials: handler } = await import('../auth/passkey.js')
    return handler(this.core, request)
  }

  /**
   * Update passkey credential
   * PATCH /auth/passkey/credentials/:credentialId
   */
  private async updatePasskeyCredential(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { updatePasskeyCredential: handler } = await import('../auth/passkey.js')
    return handler(this.core, request)
  }

  /**
   * Delete passkey credential
   * DELETE /auth/passkey/credentials/:credentialId
   */
  private async deletePasskeyCredential(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { deletePasskeyCredential: handler } = await import('../auth/passkey.js')
    return handler(this.core, request)
  }

  /**
   * Get CAPTCHA status and configuration
   * GET /auth/captcha/status
   */
  private async getCaptchaStatus(request: HttpRequest): Promise<HttpResponse> {
    const { getCaptchaStatus: handler } = await import('../auth/captcha.js')
    return handler(request, this.core)
  }

  private async verifyMFA(request: HttpRequest): Promise<HttpResponse> {
    const { verifyMFA: handler } = await import('../auth/mfa.js')
    return handler(request, this.core)
  }

  private async verifyMFABackup(request: HttpRequest): Promise<HttpResponse> {
    const { verifyMFABackup: handler } = await import('../auth/mfa.js')
    return handler(request, this.core)
  }

  private async sendMFACode(request: HttpRequest): Promise<HttpResponse> {
    const { sendMFACode: handler } = await import('../auth/mfa.js')
    return handler(request, this.core)
  }

  private async initTOTPSetup(request: HttpRequest): Promise<HttpResponse> {
    // Allow either auth token or MFA setup token (for login flow)
    if (!request.headers['x-mfa-setup-token']) {
      await this.validateAuthentication(request)
    }
    const { initTOTPSetup: handler } = await import('../auth/mfa.js')
    return handler(request, this.core)
  }

  private async verifyTOTPSetup(request: HttpRequest): Promise<HttpResponse> {
    // Allow either auth token or MFA setup token (for login flow)
    if (!request.headers['x-mfa-setup-token']) {
      await this.validateAuthentication(request)
    }
    const { verifyTOTPSetup: handler } = await import('../auth/mfa.js')
    return handler(request, this.core)
  }

  private async initEmailOTPSetup(request: HttpRequest): Promise<HttpResponse> {
    // Allow either auth token or MFA setup token (for login flow)
    if (!request.headers['x-mfa-setup-token']) {
      await this.validateAuthentication(request)
    }
    const { initEmailOTPSetup: handler } = await import('../auth/mfa.js')
    return handler(request, this.core)
  }

  private async verifyEmailOTPSetup(request: HttpRequest): Promise<HttpResponse> {
    // Allow either auth token or MFA setup token (for login flow)
    if (!request.headers['x-mfa-setup-token']) {
      await this.validateAuthentication(request)
    }
    const { verifyEmailOTPSetup: handler } = await import('../auth/mfa.js')
    return handler(request, this.core)
  }

  private async disableMFA(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { disableMFA: handler } = await import('../auth/mfa.js')
    return handler(request, this.core)
  }

  private async disableAllMFA(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { disableAllMFA: handler } = await import('../auth/mfa.js')
    return handler(request, this.core)
  }

  private async regenerateBackupCodes(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { regenerateBackupCodes: handler } = await import('../auth/mfa.js')
    return handler(request, this.core)
  }

  private async getMFAStatus(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { getMFAStatus: handler } = await import('../auth/mfa.js')
    return handler(request, this.core)
  }

  private async getTrustedDevices(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { getTrustedDevices: handler } = await import('../auth/mfa.js')
    return handler(request, this.core)
  }

  private async revokeTrustedDevice(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { revokeTrustedDevice: handler } = await import('../auth/mfa.js')
    return handler(request, this.core)
  }

  private async revokeAllTrustedDevices(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { revokeAllTrustedDevices: handler } = await import('../auth/mfa.js')
    return handler(request, this.core)
  }

  private async adminResetUserMFA(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    // Require admin role for MFA reset
    if (request.user?.role !== 'admin') {
      return this.errorResponse(new InvalidInputError('Admin access required', 'permissions'), 403)
    }
    const { adminResetUserMFA: handler } = await import('../auth/mfa.js')
    return handler(request, this.core)
  }

  /**
   * Start Device Authorization Flow
   * POST /auth/device
   * No authentication required - called by CLI
   */
  private async startDeviceAuthorization(request: HttpRequest): Promise<HttpResponse> {
    const { startDeviceAuthorization: handler } = await import('../auth/oauth2-server.js')
    return handler(this.core, request)
  }

  /**
   * Get Device Code Info (for verification page)
   * GET /auth/device/verify?code=XXXX-XXXX
   * Authentication required - called by Studio
   */
  private async getDeviceCodeInfo(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { getDeviceCodeInfo: handler } = await import('../auth/oauth2-server.js')
    return handler(this.core, request)
  }

  /**
   * Verify (Authorize/Deny) Device Code
   * POST /auth/device/verify
   * Authentication required - called by Studio
   */
  private async verifyDeviceCode(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { verifyDeviceCode: handler } = await import('../auth/oauth2-server.js')
    return handler(this.core, request)
  }

  /**
   * OAuth2 Token Endpoint
   * POST /auth/token
   * Handles device code exchange, authorization code exchange, and token refresh
   */
  private async handleOAuth2TokenRequest(request: HttpRequest): Promise<HttpResponse> {
    const { handleTokenRequest: handler } = await import('../auth/oauth2-server.js')
    return handler(this.core, request)
  }

  /**
   * Validate Authorization Request (for consent page)
   * GET /auth/authorize
   * Authentication optional - if authenticated, checks for existing consent
   */
  private async validateAuthorizationRequest(request: HttpRequest): Promise<HttpResponse> {
    // Try to authenticate, but don't fail if no token present
    // This allows consent checking for logged-in users
    try {
      await this.validateAuthentication(request)
    } catch {
      // Ignore auth errors - user just won't get auto-approval
    }
    const { validateAuthorizationRequest: handler } = await import('../auth/oauth2-server.js')
    return handler(this.core, request)
  }

  /**
   * Handle Authorization Decision (approve/deny)
   * POST /auth/authorize
   * Authentication required - called when user approves/denies
   */
  private async handleAuthorizationDecision(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { handleAuthorizationDecision: handler } = await import('../auth/oauth2-server.js')
    return handler(this.core, request)
  }

}
