/**
 * UserRoutes - User management route handlers
 */

import { SecurityValidator, InvalidInputError } from '../../core/index.js'
import type { HttpRequest, HttpResponse, RouteDefinition } from '../types.js'
import { BaseRoutes } from './base.js'

/** Preferences keys starting with "_oauth2" are the server's own records (applications' grants and consents) */
const isServerPreference = (key: string): boolean => key.startsWith('_oauth2')

/**
 * A user as these routes return it: no password hash, and none of the server's own
 * preference records, which name every application a person has signed in with (reading
 * users does not entitle anyone to that; the person sees their own under /auth/grants).
 */
function publicUser<T extends { passwordHash?: unknown; preferences?: unknown }>(user: T): Omit<T, 'passwordHash'> {
  const { passwordHash: _passwordHash, ...safeUser } = user
  if (safeUser.preferences && typeof safeUser.preferences === 'object') {
    safeUser.preferences = Object.fromEntries(
      Object.entries(safeUser.preferences as Record<string, unknown>).filter(([key]) => !isServerPreference(key))
    )
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

      // Preferences keys starting with "_oauth2" are the server's own records (applications'
      // grants and consents). An update carrying preferences keeps them as stored: a client
      // holding an older copy must not resurrect a revoked grant or drop a new one.
      if (userData.preferences && typeof userData.preferences === 'object') {
        const existing = await this.core.getUser(id)
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
