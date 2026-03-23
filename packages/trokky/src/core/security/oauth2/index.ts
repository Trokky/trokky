/**
 * OAuth2 Authorization Server
 *
 * Enables Trokky Studio to act as an OAuth2 provider for:
 * - CLI authentication (Device Authorization Grant - RFC 8628)
 * - External application SSO (Authorization Code Grant with PKCE)
 */

export {
  OAuth2AuthorizationServer,
  type OAuth2ServerConfig,
  type OAuth2ClientConfig
} from './authorization-server.js'
