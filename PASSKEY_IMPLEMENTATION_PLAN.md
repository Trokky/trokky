# Passkey Authentication Implementation Plan

## Overview

Add WebAuthn/Passkey support to Trokky as a **primary authentication method** - users can click "Sign in with Passkey" on the login page and authenticate directly with biometrics or security keys, similar to "Sign in with Google".

## Architecture Decision

**Approach: Passkeys as Primary Auth (like OAuth)**
- Passkey button on login page alongside Google OAuth
- Direct authentication without password
- Users register passkeys in account settings
- Follows existing OAuth patterns for consistency

## Dependencies

```json
{
  "@simplewebauthn/server": "^11.0.0",
  "@simplewebauthn/browser": "^11.0.0"
}
```

- `@simplewebauthn/server` - Server-side WebAuthn operations (challenge generation, verification)
- `@simplewebauthn/browser` - Browser credential API wrapper

## Implementation Tasks

### Phase 1: Core Infrastructure

#### 1.1 Types Definition
**File:** `packages/types/src/passkey.ts`

```typescript
export interface PasskeyCredential {
  id: string                              // Base64URL credential ID
  publicKey: string                       // Base64URL public key
  counter: number                         // Signature counter (replay protection)
  deviceType: 'singleDevice' | 'multiDevice'
  backedUp: boolean                       // Synced to cloud (e.g., iCloud Keychain)
  transports?: AuthenticatorTransport[]   // usb, ble, nfc, internal
  createdAt: string
  lastUsedAt?: string
  friendlyName?: string                   // "MacBook Pro Touch ID"
  aaguid?: string                         // Authenticator identifier
}

export interface PasskeyConfig {
  enabled: boolean
  rpId: string                            // Relying Party ID (domain)
  rpName: string                          // Human-readable name
  origin: string | string[]               // Allowed origins
  attestation?: 'none' | 'indirect' | 'direct' | 'enterprise'
  userVerification?: 'required' | 'preferred' | 'discouraged'
  timeout?: number                        // Challenge timeout in ms
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform'
    residentKey?: 'required' | 'preferred' | 'discouraged'
    requireResidentKey?: boolean
  }
}

export interface PasskeyRegistrationOptions {
  challenge: string                       // Base64URL challenge
  sessionId: string                       // Server session ID
  rpId: string
  rpName: string
  userId: string                          // Base64URL user ID
  userName: string
  userDisplayName: string
  excludeCredentials: { id: string; type: 'public-key'; transports?: string[] }[]
  authenticatorSelection: object
  attestation: string
  timeout: number
}

export interface PasskeyAuthenticationOptions {
  challenge: string
  sessionId: string
  rpId: string
  allowCredentials: { id: string; type: 'public-key'; transports?: string[] }[]
  userVerification: string
  timeout: number
}
```

#### 1.2 User Model Extension
**File:** `packages/types/src/auth.ts`

Add to existing User interface:
```typescript
interface User {
  // ... existing fields
  passkeys?: PasskeyCredential[]
}
```

#### 1.3 Configuration Extension
**File:** `packages/core/src/types/config.ts`

Add passkey config to SecurityConfig:
```typescript
interface SecurityConfig {
  // ... existing fields
  passkey?: PasskeyConfig
}
```

---

### Phase 2: Server-Side Routes

#### 2.1 Passkey Routes
**File:** `packages/routes/src/auth/passkey.ts`

```typescript
// Registration Flow (authenticated users adding passkeys)
POST /auth/passkey/register/options    // Generate registration challenge
POST /auth/passkey/register/verify     // Verify and store credential

// Authentication Flow (login page)
POST /auth/passkey/login/options       // Generate authentication challenge
POST /auth/passkey/login/verify        // Verify assertion, return JWT

// Management (authenticated)
GET    /auth/passkey/credentials       // List user's passkeys
DELETE /auth/passkey/credentials/:id   // Remove a passkey
PATCH  /auth/passkey/credentials/:id   // Update friendly name

// Status (public)
GET    /auth/passkey/status            // Check if passkeys are enabled
```

#### 2.2 Route Handlers Detail

**GET /auth/passkey/status**
```typescript
// Public endpoint - check if passkeys are enabled
// Response: { success: true, data: { enabled: boolean } }
```

**POST /auth/passkey/register/options** (Authenticated)
```typescript
// Requires: authenticated user
// Input: { friendlyName?: string }
// Process:
//   1. Get user's existing passkeys (for excludeCredentials)
//   2. Generate challenge using @simplewebauthn/server
//   3. Store session with challenge, userId, expiry (5 min)
//   4. Return registration options
// Response: PasskeyRegistrationOptions
```

**POST /auth/passkey/register/verify** (Authenticated)
```typescript
// Requires: authenticated user
// Input: { sessionId, credential: RegistrationResponseJSON, friendlyName? }
// Process:
//   1. Retrieve and validate session
//   2. Verify registration response with @simplewebauthn/server
//   3. Create PasskeyCredential object
//   4. Add to user.passkeys array
//   5. Save user
//   6. Clean up session
// Response: { success: true, data: { credential: PasskeyCredential } }
```

**POST /auth/passkey/login/options**
```typescript
// Public endpoint
// Input: { username?: string } (optional - for targeted auth)
// Process:
//   1. If username provided, get user's passkeys for allowCredentials
//   2. If no username, use empty allowCredentials (discoverable credentials)
//   3. Generate challenge
//   4. Store session with challenge, expiry (5 min)
// Response: PasskeyAuthenticationOptions
```

**POST /auth/passkey/login/verify**
```typescript
// Public endpoint
// Input: { sessionId, credential: AuthenticationResponseJSON, deviceId? }
// Process:
//   1. Retrieve and validate session
//   2. Find user by credential ID (search all users' passkeys)
//   3. Verify authentication response
//   4. Update credential counter and lastUsedAt
//   5. Check if MFA required (other methods configured)
//   6. Handle trusted device check
//   7. Generate JWT tokens (same as OAuth callback)
// Response: Same as OAuth - { token, refreshToken, user, expiresAt } or MFA response
```

**GET /auth/passkey/credentials** (Authenticated)
```typescript
// Response: { success: true, data: { credentials: PasskeyCredential[] } }
// Note: Never return publicKey to client
```

**DELETE /auth/passkey/credentials/:id** (Authenticated)
```typescript
// Requires: user owns the credential
// Process: Remove credential from user.passkeys, save user
```

**PATCH /auth/passkey/credentials/:id** (Authenticated)
```typescript
// Input: { friendlyName: string }
// Process: Update credential friendlyName, save user
```

#### 2.3 Session Store
**File:** `packages/routes/src/auth/passkey.ts`

```typescript
// In-memory challenge store (similar to OAuth state store)
const passkeySessionStore = new Map<string, {
  challenge: string
  userId?: string           // For registration
  expectedOrigin: string
  expectedRPID: string
  mode: 'register' | 'login'
  expiresAt: number
}>()

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of passkeySessionStore) {
    if (value.expiresAt < now) {
      passkeySessionStore.delete(key)
    }
  }
}, 60 * 1000) // Every minute
```

#### 2.4 Core Service Methods
**File:** `packages/core/src/security/auth.ts`

Add to AuthenticationService:
```typescript
// Find user by passkey credential ID
async findUserByPasskeyCredentialId(credentialId: string): Promise<User | null>

// Add passkey to user
async addPasskeyToUser(userId: string, credential: PasskeyCredential): Promise<void>

// Remove passkey from user
async removePasskeyFromUser(userId: string, credentialId: string): Promise<void>

// Update passkey (counter, lastUsedAt, friendlyName)
async updateUserPasskey(userId: string, credentialId: string, updates: Partial<PasskeyCredential>): Promise<void>

// Check if passkey auth is configured
isPasskeyConfigured(): boolean
```

---

### Phase 3: Studio Components

#### 3.1 Passkey Login Button
**File:** `packages/studio/src/components/auth/PasskeyLoginButton.tsx`

```typescript
interface PasskeyLoginButtonProps {
  onSuccess?: () => void
  onError?: (error: string) => void
  disabled?: boolean
  className?: string
}

// Component behavior:
// 1. Call /auth/passkey/login/options
// 2. Store sessionId in sessionStorage
// 3. Call navigator.credentials.get() via @simplewebauthn/browser
// 4. Call /auth/passkey/login/verify with response
// 5. Handle success (store tokens, redirect) or MFA flow
// 6. Handle errors (no passkey, user cancelled, etc.)
```

#### 3.2 Login Page Integration
**File:** `packages/studio/src/pages/LoginPage.tsx`

Add alongside Google OAuth button:
```typescript
{/* Passkey Login */}
{passkeyEnabled && (
  <PasskeyLoginButton
    onSuccess={() => navigate('/')}
    onError={(err) => setError(err)}
    disabled={isLoading}
  />
)}

{/* OAuth Login Options */}
{googleOAuthEnabled && (
  // ... existing Google button
)}
```

Check passkey status on mount:
```typescript
const checkPasskeyStatus = async () => {
  try {
    const response = await apiClient.get<{ enabled: boolean }>('/auth/passkey/status')
    if (response.success && response.data?.enabled) {
      // Also check browser support
      if (window.PublicKeyCredential) {
        setPasskeyEnabled(true)
      }
    }
  } catch (error) {
    logger.debug('Passkey status check failed:', error)
  }
}
```

#### 3.3 Passkey Registration Component
**File:** `packages/studio/src/components/auth/PasskeyRegistration.tsx`

For account settings - allows users to add new passkeys:
```typescript
interface PasskeyRegistrationProps {
  onSuccess?: (credential: PasskeyCredential) => void
  onError?: (error: string) => void
}

// Component behavior:
// 1. User enters friendly name (optional)
// 2. Call /auth/passkey/register/options
// 3. Call navigator.credentials.create() via @simplewebauthn/browser
// 4. Call /auth/passkey/register/verify
// 5. Show success, call onSuccess
```

#### 3.4 Passkey Management Component
**File:** `packages/studio/src/components/auth/PasskeyManager.tsx`

For account settings - list and manage passkeys:
```typescript
// Features:
// - List all registered passkeys
// - Show device type icon (platform vs cross-platform)
// - Show last used date
// - Edit friendly name
// - Delete passkey (with confirmation)
// - Add new passkey button
```

#### 3.5 Account Settings Integration
**File:** `packages/studio/src/pages/AccountSettingsPage.tsx`

Add passkey management section:
```typescript
{/* Passkeys Section */}
{passkeyEnabled && (
  <section>
    <h2>Passkeys</h2>
    <p>Sign in without a password using your device's biometrics or security key.</p>
    <PasskeyManager />
  </section>
)}
```

---

### Phase 4: Configuration

#### 4.1 Config Schema
**File:** `packages/core/src/config/schema.ts`

```typescript
passkey: z.object({
  enabled: z.boolean().default(false),
  rpId: z.string(),                    // Required: domain name
  rpName: z.string().default('Trokky'),
  origin: z.union([z.string(), z.array(z.string())]),
  attestation: z.enum(['none', 'indirect', 'direct', 'enterprise']).default('none'),
  userVerification: z.enum(['required', 'preferred', 'discouraged']).default('preferred'),
  timeout: z.number().default(60000),  // 60 seconds
  authenticatorSelection: z.object({
    authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
    residentKey: z.enum(['required', 'preferred', 'discouraged']).default('preferred'),
    requireResidentKey: z.boolean().default(false),
  }).optional(),
}).optional()
```

#### 4.2 Example Configuration
**File:** `examples/demo/trokky.config.ts`

```typescript
security: {
  // ... existing config

  passkey: process.env.PASSKEY_ENABLED === 'true' ? {
    enabled: true,
    rpId: process.env.PASSKEY_RP_ID || 'localhost',
    rpName: process.env.PASSKEY_RP_NAME || 'Trokky Demo',
    origin: process.env.PASSKEY_ORIGIN || 'http://localhost:5173',
    userVerification: 'preferred',
    authenticatorSelection: {
      residentKey: 'preferred',        // Enable discoverable credentials
    },
  } : undefined,
}
```

#### 4.3 Environment Variables
```env
# Passkey Configuration
PASSKEY_ENABLED=true
PASSKEY_RP_ID=localhost
PASSKEY_RP_NAME=Trokky Demo
PASSKEY_ORIGIN=http://localhost:5173
```

---

### Phase 5: Testing

#### 5.1 Unit Tests
**File:** `packages/routes/src/auth/__tests__/passkey.test.ts`

```typescript
describe('Passkey Authentication', () => {
  describe('GET /auth/passkey/status', () => {
    test('returns enabled when configured')
    test('returns disabled when not configured')
  })

  describe('POST /auth/passkey/login/options', () => {
    test('generates valid challenge')
    test('includes allowCredentials when username provided')
    test('returns empty allowCredentials for discoverable flow')
    test('stores session with expiry')
  })

  describe('POST /auth/passkey/login/verify', () => {
    test('verifies valid credential')
    test('rejects invalid credential')
    test('rejects expired session')
    test('updates counter after successful auth')
    test('returns JWT tokens on success')
    test('returns MFA token when MFA required')
    test('handles trusted device check')
  })

  describe('POST /auth/passkey/register/options', () => {
    test('requires authentication')
    test('excludes existing credentials')
    test('generates valid registration options')
  })

  describe('POST /auth/passkey/register/verify', () => {
    test('requires authentication')
    test('stores new credential')
    test('rejects duplicate credential')
  })

  describe('Credential Management', () => {
    test('lists user credentials')
    test('deletes credential')
    test('updates friendly name')
    test('prevents deleting other users credentials')
  })
})
```

#### 5.2 Integration Tests
**File:** `packages/routes/src/auth/__tests__/passkey.integration.test.ts`

```typescript
describe('Passkey Integration', () => {
  test('full registration flow')
  test('full login flow')
  test('login with MFA')
  test('multiple passkeys per user')
})
```

---

## File Changes Summary

### New Files
| Package | File | Description |
|---------|------|-------------|
| types | `src/passkey.ts` | Passkey type definitions |
| routes | `src/auth/passkey.ts` | Passkey route handlers |
| routes | `src/auth/__tests__/passkey.test.ts` | Route tests |
| studio | `src/components/auth/PasskeyLoginButton.tsx` | Login button |
| studio | `src/components/auth/PasskeyRegistration.tsx` | Registration flow |
| studio | `src/components/auth/PasskeyManager.tsx` | Credential management |

### Modified Files
| Package | File | Changes |
|---------|------|---------|
| types | `src/auth.ts` | Add passkeys to User interface |
| types | `src/index.ts` | Export passkey types |
| core | `src/types/config.ts` | Add PasskeyConfig |
| core | `src/security/auth.ts` | Add passkey service methods |
| core | `src/config/schema.ts` | Add passkey config validation |
| routes | `src/auth/index.ts` | Export passkey routes |
| routes | `src/index.ts` | Register passkey routes |
| studio | `src/pages/LoginPage.tsx` | Add passkey button |
| studio | `src/pages/AccountSettingsPage.tsx` | Add passkey section |
| demo | `trokky.config.ts` | Add passkey config example |
| demo | `.env.example` | Add passkey env vars |

### Dependencies to Add
| Package | Dependency | Version |
|---------|------------|---------|
| routes | `@simplewebauthn/server` | ^11.0.0 |
| studio | `@simplewebauthn/browser` | ^11.0.0 |

---

## Security Considerations

1. **Challenge Expiry**: 5 minutes max, single use
2. **Counter Verification**: Prevent replay attacks
3. **Origin Validation**: Strict origin checking
4. **User Verification**: Require biometric/PIN by default
5. **Credential Storage**: Public keys only (no secrets)
6. **Rate Limiting**: Apply to login/options endpoint
7. **Session Cleanup**: Periodic cleanup of expired sessions

---

## UX Flow

### Login with Passkey
1. User clicks "Sign in with Passkey" button
2. Browser prompts for biometric/security key
3. User authenticates with Touch ID/Face ID/PIN/Key
4. User is logged in (or prompted for MFA if configured)

### Register New Passkey
1. User goes to Account Settings > Passkeys
2. User clicks "Add Passkey"
3. User enters friendly name (e.g., "MacBook Pro")
4. Browser prompts to create passkey
5. User authenticates with biometric
6. Passkey is saved and listed

### Manage Passkeys
1. User views list of registered passkeys
2. User can rename or delete passkeys
3. Shows last used date and device type

---

## Implementation Order

1. **Phase 1**: Types and configuration (foundation)
2. **Phase 2**: Server routes (backend complete)
3. **Phase 3**: Studio components (frontend complete)
4. **Phase 4**: Configuration and examples
5. **Phase 5**: Testing and documentation

Estimated implementation: Methodical step-by-step approach following existing patterns.
