/**
 * SystemRoutes - site diagnostics (trokky doctor)
 */

import type { HttpRequest, HttpResponse, RouteDefinition } from '../types.js'
import { BaseRoutes } from './base.js'

export class SystemRoutes extends BaseRoutes {
  public getRoutes(): RouteDefinition[] {
    const basePath = this.config.basePath || ''
    return this.defineRoutes([['GET', `${basePath}/system/doctor`, this.getDoctorReport.bind(this)]])
  }

  /**
   * The doctor report. settings:read is held by admins by default (or granted explicitly); a CLI
   * or agent session reaches it with the system:read scope, which carries it only for such a user.
   */
  private async getDoctorReport(request: HttpRequest): Promise<HttpResponse> {
    try {
      await this.requirePermission(request, 'settings:read')
      return this.successResponse(await this.core.diagnose())
    } catch (error) {
      return this.errorResponse(error)
    }
  }
}
