/**
 * Types for route handlers
 */

import type { RoutesConfig } from '../types.js'

/**
 * Configuration passed to route handlers.
 *
 * This is the same object reference held by TrokkyRoutes (never a copy), so
 * late-bound properties like studioConfig/structureConfig stay visible.
 */
export type RouteHandlerConfig = RoutesConfig

export type { HttpRequest, HttpResponse, RouteDefinition } from '../types.js'
