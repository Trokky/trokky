/**
 * UserRoutes - User management route handlers
 */

import { SecurityValidator, InvalidInputError } from '../../core/index.js'
import type { MFAConfig } from '../../types/auth.js'
import type { HttpRequest, HttpResponse, RouteDefinition } from '../types.js'
import { BaseRoutes } from './base.js'

/** Preferences keys starting with "_oauth2" are the server's own records (applications' grants and consents) */
const isServerPreference = (key: string): boolean => key.startsWith('_oauth2')

/** Fields PUT /users/:id may change */
const EDITABLE_USER_FIELDS = new Set([
  'username', 'email', 'firstName', 'lastName', 'fullName', 'role', 'permissions',
  'isActive', 'active', 'profileImage', 'preferences', 'password'
])

/** Server-set fields PUT /users/:id ignores instead of refusing */
const READ_ONLY_USER_FIELDS = ['id', 'createdAt', 'updatedAt', 'lastLoginAt']

/**
 * A user as these routes return it: no password hash, and none of the server's own
 * preference records, which name every application a person has signed in with (reading
 * users does not entitle anyone to that; the person sees their own under /auth/grants).
 */
function publicUser<T extends { passwordHash?: unknown; preferences?: unknown }>(user: T): Omit<T, 'passwordHash' | 'password'> {
  // `password` too: before updateUser hashed it, an edit stored the clear text in the record
  const { passwordHash: _passwordHash, password: _password, ...safeUser } = user as T & { password?: unknown }
  if (safeUser.preferences && typeof safeUser.preferences === 'object') {
    safeUser.preferences = Object.fromEntries(
      Object.entries(safeUser.preferences as Record<string, unknown>).filter(([key]) => !isServerPreference(key))
    )
  }
  // Whether MFA is on and with which methods, as Studio shows it; not the TOTP secrets, backup
  // code hashes or trusted-device records, which reading users does not entitle anyone to.
  const mfa = (safeUser as { mfa?: MFAConfig }).mfa
  if (mfa && typeof mfa === 'object') {
    const { backupCodes: _codes, trustedDevices: _devices, ...shownMfa } = mfa
    ;(safeUser as { mfa?: unknown }).mfa = {
      ...shownMfa,
      methods: Array.isArray(mfa.methods) ? mfa.methods.map(({ secret: _secret, ...method }) => method) : mfa.methods
    }
  }
  return safeUser
}

export class UserRoutes extends BaseRoutes {
  public getRoutes(): RouteDefinition[] {
    const basePath = this.config.basePath || ''
    return this.defineRoutes([
      ['GET', `${basePath}/users`, this.listUsers.bind(this)],
      ['POST', `${basePath}/users`, this.createUser.bind(this)],
      ['GET', `${basePath}/users/:id`, this.getUser.bind(this)],
      ['PUT', `${basePath}/users/:id`, this.updateUser.bind(this)],
      ['DELETE', `${basePath}/users/:id`, this.deleteUser.bind(this)],
      ['GET', `${basePath}/users/by-username/:username`, this.getUserByUsername.bind(this)],
      ['GET', `${basePath}/users/by-email/:email`, this.getUserByEmail.bind(this)]
    ])
  }

  // User management handlers
  private async listUsers(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and read permissions
      await this.validateAuthentication(request)
      await this.validateUserReadAccess(request)

      const { role, isActive, limit, offset } = request.query

      // Build list options
      const options: any = {}
      if (role && typeof role === 'string') options.role = role
      if (isActive !== undefined) options.isActive = isActive === 'true'
      if (limit) options.limit = parseInt(String(limit), 10)
      if (offset) options.offset = parseInt(String(offset), 10)

      const users = await this.core.listUsers(options)

      // Remove password hashes from response
      const safeUsers = users.map(user => {
        const safeUser = publicUser(user)
        return safeUser
      })

      return this.successResponse({
        users: safeUsers,
        meta: {
          total: safeUsers.length,
          limit: options.limit,
          offset: options.offset
        }
      })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  /**
   * users:write lets a non-admin manage users, not admins. Without this a delegate could create
   * an admin, or set an admin's password and sign in as them.
   */
  private refuseAdminChangeByNonAdmin(request: HttpRequest, targetRole: unknown, newRole?: unknown): void {
    if (!request.user || request.user.role === 'admin') return
    if (targetRole === 'admin' || newRole === 'admin') {
      // 'permission' is the field errorResponse turns into a 403
      throw new InvalidInputError('Only an admin can create, change or delete an admin account', 'permission')
    }
  }

  private async createUser(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and admin privileges
      await this.validateAuthentication(request)
      await this.validateAdminAccess(request)

      // SECURITY: Validate request body structure
      if (!request.body || typeof request.body !== 'object') {
        throw new InvalidInputError('Request body is required', 'body')
      }

      let userData = request.body as Record<string, unknown>

      // Transform fullName to firstName and lastName if present
      if (userData.fullName && typeof userData.fullName === 'string') {
        const fullName = userData.fullName.trim()
        const nameParts = fullName.split(' ')
        userData = {
          ...userData,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || ''
        }
        delete userData.fullName
      }

      // Transform 'active' to 'isActive' if present
      if ('active' in userData) {
        userData.isActive = userData.active
        delete userData.active
      }

      if (userData.preferences && typeof userData.preferences === 'object') {
        userData.preferences = Object.fromEntries(Object.entries(userData.preferences as Record<string, unknown>)
          .filter(([key]) => !isServerPreference(key)))
      }

      // Debug: Log what data we're receiving
      this.logger.debug('Creating user with transformed data:', { userData })

      this.refuseAdminChangeByNonAdmin(request, undefined, userData.role)

      const user = await this.core.createUser(userData as any)

      // Remove password hash from response
      const safeUser = publicUser(user)

      return this.successResponse({ user: safeUser }, 201)
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async getUser(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and read permissions
      await this.validateAuthentication(request)
      await this.validateUserReadAccess(request)

      const { id } = request.params
      SecurityValidator.validateDocumentId(id)

      const user = await this.core.getUser(id)
      if (!user) {
        return this.errorResponse(new Error(`User ${id} not found`), 404)
      }

      // Remove password hash from response
      const safeUser = publicUser(user)

      return this.successResponse({ user: safeUser })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async updateUser(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and admin privileges
      await this.validateAuthentication(request)
      await this.validateAdminAccess(request)

      const { id } = request.params
      SecurityValidator.validateDocumentId(id)

      // SECURITY: Validate request body structure
      if (!request.body || typeof request.body !== 'object') {
        throw new InvalidInputError('User data is required', 'body')
      }

      let userData = { ...(request.body as Record<string, unknown>) }

      // A password is set by sending `password`, which updateUser hashes. Accepting a hash from
      // the client would let it write any hash, or one from another algorithm, unverified.
      if ('passwordHash' in userData) {
        throw new InvalidInputError('passwordHash cannot be set; send password instead', 'passwordHash')
      }

      // Only what the edit form changes. MFA, passkeys and linked OAuth accounts have their own
      // endpoints: writing them here let an admin turn off another user's MFA, or attach their
      // own sign-in to someone else's account, without leaving the trail those endpoints do.
      // Timestamps and the id are ignored rather than refused: they are not the client's to set,
      // but echoing them back is harmless.
      for (const key of READ_ONLY_USER_FIELDS) delete userData[key]
      const refused = Object.keys(userData).filter(key => !EDITABLE_USER_FIELDS.has(key))
      if (refused.length > 0) {
        throw new InvalidInputError(`These user fields cannot be set here: ${refused.join(', ')}`, refused[0])
      }

      // Studio's form sends `active`; createUser already maps it. Left as is, unticking Active
      // stored an unused key and the account kept signing in.
      if ('active' in userData) {
        userData.isActive = userData.active
        delete userData.active
      }
      // A string such as "false" is truthy where the record is read as a boolean, so the account
      // stayed usable on some storage adapters and not others.
      if ('isActive' in userData && typeof userData.isActive !== 'boolean') {
        throw new InvalidInputError('active must be true or false', 'isActive')
      }

      // Nobody changes their own access here: deactivating yourself or dropping your own admin
      // role locks you out, and a non-admin holding users:write could make themselves admin.
      // Studio sends the current role, permissions and state with every edit, so only a change
      // to them is refused.
      const existing = await this.core.getUser(id)
      this.refuseAdminChangeByNonAdmin(request, existing?.role, userData.role)
      if (existing && request.user?.id === id) {
        const samePermissions = (a: unknown, b: unknown): boolean =>
          JSON.stringify([...((a as string[] | undefined) ?? [])].sort()) ===
          JSON.stringify([...((b as string[] | undefined) ?? [])].sort())
        const changed = [
          'role' in userData && userData.role !== existing.role ? 'role' : null,
          'isActive' in userData && userData.isActive !== (existing.isActive ?? true) ? 'isActive' : null,
          'permissions' in userData && !samePermissions(userData.permissions, existing.permissions) ? 'permissions' : null
        ].filter((field): field is string => field !== null)
        if (changed.length > 0) {
          // 'permission' is the field errorResponse turns into a 403
          throw new InvalidInputError(`You cannot change your own ${changed.join(', ')}`, 'permission')
        }
      }

      // Transform fullName to firstName and lastName if present
      if (userData.fullName && typeof userData.fullName === 'string') {
        const fullName = userData.fullName.trim()
        const nameParts = fullName.split(' ')
        userData = {
          ...userData,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || ''
        }
        delete userData.fullName
      }

      // Preferences keys starting with "_oauth2" are the server's own records (applications'
      // grants and consents). An update carrying preferences keeps them as stored: a client
      // holding an older copy must not resurrect a revoked grant or drop a new one.
      if (userData.preferences && typeof userData.preferences === 'object') {
        const serverKeys = Object.entries((existing?.preferences ?? {}) as Record<string, unknown>)
          .filter(([key]) => isServerPreference(key))
        const incoming = Object.fromEntries(Object.entries(userData.preferences as Record<string, unknown>)
          .filter(([key]) => !isServerPreference(key)))
        userData = { ...userData, preferences: { ...incoming, ...Object.fromEntries(serverKeys) } }
      }

      // Debug: Log what data we're receiving
      this.logger.debug('Updating user with transformed data:', { id, userData })

      const user = await this.core.updateUser(id, userData)

      // Remove password hash from response
      const safeUser = publicUser(user)

      // Same event as change-password and password-reset, so its webhooks and notices fire when
      // an admin sets the password too. An empty password is the form's "unchanged".
      if (typeof userData.password === 'string' && userData.password !== '') {
        this.core.events.emitEvent({
          type: 'user.password_changed',
          source: 'api',
          data: { user: safeUser, changedAt: new Date(), userId: user.id, changedBy: request.user?.id }
        }).catch((error: unknown) => {
          this.logger.error('Failed to emit user.password_changed event', error)
        })
      }

      return this.successResponse({ user: safeUser })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async deleteUser(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and admin privileges
      await this.validateAuthentication(request)
      await this.validateAdminAccess(request)

      const { id } = request.params
      SecurityValidator.validateDocumentId(id)
      this.refuseAdminChangeByNonAdmin(request, (await this.core.getUser(id))?.role)

      await this.core.deleteUser(id)
      return this.successResponse({ message: 'User deleted successfully' })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async getUserByUsername(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and admin privileges
      await this.validateAuthentication(request)
      await this.validateAdminAccess(request)

      const { username } = request.params
      SecurityValidator.validateUsername(username)

      const user = await this.core.getUserByUsername(username)
      if (!user) {
        return this.errorResponse(new Error(`User with username ${username} not found`), 404)
      }

      // Remove password hash from response
      const safeUser = publicUser(user)

      return this.successResponse({ user: safeUser })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async getUserByEmail(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and admin privileges
      await this.validateAuthentication(request)
      await this.validateAdminAccess(request)

      const { email } = request.params
      SecurityValidator.validateEmail(decodeURIComponent(email))

      const user = await this.core.getUserByEmail(decodeURIComponent(email))
      if (!user) {
        return this.errorResponse(new Error(`User with email ${email} not found`), 404)
      }

      // Remove password hash from response
      const safeUser = publicUser(user)

      return this.successResponse({ user: safeUser })
    } catch (error) {
      return this.errorResponse(error)
    }
  }
}
