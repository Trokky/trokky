# @trokky/trokky

> Official CLI and SDK for Trokky CMS - TypeScript-native content management

## Installation

### Global CLI Installation

```bash
npm install -g @trokky/trokky
```

After installation, you can use the `trokky` command globally:

```bash
trokky --help
```

### Local SDK Installation

```bash
npm install @trokky/trokky
```

## CLI Commands

### Login

Authenticate with a Trokky instance using browser-based OAuth2 Device Authorization:

```bash
trokky login https://your-site.com --name my-instance
```

This opens your browser for authentication. Once approved, credentials are saved locally.

Options:
- `--name` - Name for this instance in config (default: derived from URL)
- `--set-default` - Set this instance as the default (default: true)

### Config

Manage saved Trokky instances:

```bash
# List all configured instances
trokky config list

# Add instance manually with API token
trokky config add my-instance --url https://your-site.com/api --token YOUR_TOKEN

# Remove an instance
trokky config remove my-instance

# Set default instance
trokky config set-default my-instance

# Show config file location
trokky config path
```

Once configured, you can run commands without `--url` and `--token`:

```bash
# Uses default instance
trokky backup --output backup.zip

# Uses specific instance
trokky backup --instance my-instance --output backup.zip
```

### Backup

Create a complete backup of your Trokky CMS:

```bash
trokky backup --url https://your-site.com/api --token YOUR_READ_TOKEN --output backup.zip
```

Options:
- `--url` - API endpoint URL
- `--token` - Authentication token (read permissions required)
- `--output` - Output file path (default: `trokky-backup-[timestamp].zip`)
- `--collections` - Specific collections to backup (comma-separated)
- `--skip-media` - Skip media files (not recommended - may break references)

**Media files are included by default** to ensure media references work correctly after restore.

### Restore

Restore from a backup with smart reference mapping:

```bash
trokky restore --url https://your-site.com/api --token YOUR_WRITE_TOKEN --input backup.zip --clean
```

Options:
- `--url` - API endpoint URL  
- `--token` - Authentication token (write permissions required)
- `--input` - Backup file path
- `--clean` - Delete existing content before restore (recommended)
- `--collections` - Specific collections to restore (comma-separated)
- `--dry-run` - Preview what would be restored without making changes

### Migration

Migrate content between different Trokky instances with smart reference mapping:

```bash
# Preview migration first
trokky migrate --from https://staging.com/api --to https://dev.com/api --from-token READ_TOKEN --to-token WRITE_TOKEN --dry-run

# Perform migration with clean target
trokky migrate --from https://staging.com/api --to https://dev.com/api --from-token READ_TOKEN --to-token WRITE_TOKEN --clean
```

Options:
- `--from` - Source Trokky instance URL
- `--to` - Target Trokky instance URL
- `--from-token` - Source authentication token (read permissions)
- `--to-token` - Target authentication token (write permissions)
- `--collections` - Specific collections to migrate (auto-discovers if not specified)
- `--skip-media` - Skip media files (not recommended - may break references)
- `--clean` - Clean target instance before migration
- `--dry-run` - Preview changes without applying them
- `--force` - Skip production URL warnings (use with extreme caution)

**Migration Features:**
- **Auto-discovery**: Automatically discovers all collections from source
- **Media migration**: Includes media files by default with reference mapping
- **Reference updates**: Updates media and document references to new IDs
- **Production safety**: Detects and warns about production URLs
- **Clean migration**: Option to clean target before migration

### Documents

Quick CRUD operations for content management (alias: `trokky docs`):

```bash
# List documents in a collection
trokky documents list posts
trokky documents list posts --limit 10 --offset 0
trokky documents list posts --filter '{"status":"published"}'
trokky documents list posts --sort '{"_createdAt":"desc"}'
trokky documents list posts --ids-only    # Just IDs for piping

# Get a single document
trokky documents get posts abc123
trokky documents get posts abc123 --pretty

# Create a document
trokky documents create posts ./post.json
trokky documents create posts --data '{"title":"Hello World"}'
echo '{"title":"From stdin"}' | trokky documents create posts

# Update a document
trokky documents update posts abc123 ./updated.json
trokky documents update posts abc123 --data '{"title":"New Title"}'
trokky documents update posts abc123 --patch '{"status":"published"}'  # Partial update

# Delete document(s)
trokky documents delete posts abc123
trokky documents delete posts abc123 def456 ghi789
trokky documents delete posts abc123 --confirm  # Skip confirmation
```

**Global Options:**
- `--url <url>` - Trokky instance URL (or `TROKKY_URL` env var)
- `--token <token>` - API token (or `TROKKY_TOKEN` env var)
- `--instance <name>` - Use a specific configured instance
- `--pretty` - Colorized, formatted JSON output
- `--quiet` - Suppress status messages (for scripting)

**List Options:**
- `--limit <n>` - Number of documents to return
- `--offset <n>` - Offset for pagination
- `--filter <json>` - Filter criteria as JSON
- `--sort <json>` - Sort criteria as JSON
- `--ids-only` - Output only document IDs (one per line, for piping)

**Create/Update Options:**
- `[file]` - JSON file path
- `--data <json>` - Inline JSON data
- `--patch <json>` - Partial update (update only, merges with existing)

**Delete Options:**
- `--confirm` - Skip confirmation prompt (for scripting)

**Piping Examples:**
```bash
# Delete all drafts
trokky documents list posts --filter '{"status":"draft"}' --ids-only | \
  xargs trokky documents delete posts --confirm

# Export to file
trokky documents list posts > posts-backup.json
```

### Clean

Remove all content from a Trokky instance (useful for development/testing):

```bash
trokky clean --url https://dev-site.com/api --token YOUR_TOKEN --dry-run
trokky clean --url https://dev-site.com/api --token YOUR_TOKEN --confirm
```

Options:
- `--url` - API endpoint URL
- `--token` - Authentication token (write permissions required)
- `--collections` - Specific collections to clean (comma-separated)
- `--media-only` - Clean only media files, leave documents intact
- `--documents-only` - Clean only documents, leave media files intact
- `--dry-run` - Preview what would be deleted without actually deleting
- `--confirm` - Required flag to confirm destructive operation
- `--force` - Skip production URL safety warnings (use with extreme caution)

**Safety Features:**
- **Production detection**: Automatically detects and warns about production URLs
- **Double confirmation**: Requires explicit `--confirm` flag for actual deletion
- **Dry run mode**: Preview deletions with `--dry-run` before committing
- **Selective cleaning**: Clean only specific collections or media vs documents

## SDK Usage

```typescript
import { TrokkyClient } from '@trokky/trokky'

const client = new TrokkyClient({
  baseUrl: 'https://your-site.com/api',
  token: 'your-token'
})

// Get documents
const articles = await client.getDocuments('article')

// Create document
const newArticle = await client.createDocument('article', {
  title: 'My Article',
  content: 'Article content...'
})

// Upload media
const file = new File([buffer], 'image.jpg')
const media = await client.uploadFile(file)
```

## Features

### Smart Reference Mapping
- **Media References**: Automatically detects and updates media field references (`asset._ref` pattern)
- **Cross-Document References**: Handles document-to-document relationships
- **Nested References**: Processes references at any depth in document structure
- Preserves content integrity across environments

### Clean Deployments
- `--clean` flag removes existing content before restore
- Prevents duplicate content and broken references
- Ensures consistent state after restore

### Cross-Environment Support
- Backup from local, restore to production
- Environment-agnostic content migration
- Handles different media storage backends

### Comprehensive Backup
- All documents and collections
- Media files with metadata
- Reference relationships
- System configuration

## Authentication

There are two ways to authenticate with Trokky:

### Option 1: Browser Login (Recommended)

Use the `trokky login` command for browser-based authentication:

```bash
trokky login https://your-site.com --name my-instance
```

This uses OAuth2 Device Authorization Flow - your browser opens, you log in to Studio, and credentials are saved automatically with refresh token support.

### Option 2: API Tokens

Get API tokens from your Trokky Studio:
1. Go to `/studio` in your Trokky instance
2. Navigate to Settings > API Keys
3. Generate tokens with appropriate permissions:
   - **Read** tokens for backup
   - **Write** tokens for restore/migration

Add tokens to your config:

```bash
trokky config add my-instance --url https://your-site.com/api --token YOUR_TOKEN
```

## Examples

### Complete Site Migration

```bash
# 1. Backup from staging
trokky backup --url https://staging.example.com/api --token READ_TOKEN --output staging-backup.zip

# 2. Restore to production  
trokky restore --url https://production.example.com/api --token WRITE_TOKEN --input staging-backup.zip --clean
```

### Selective Content Restore

```bash
# Restore only articles and media
trokky restore --url https://site.com/api --token TOKEN --input backup.zip --collections article,media --clean
```

### Preview Restore

```bash
# See what would be restored without making changes
trokky restore --url https://site.com/api --token TOKEN --input backup.zip --dry-run
```

### Development Workflow with Clean

```bash
# 1. Preview what would be deleted
trokky clean --url https://dev.example.com/api --token TOKEN --dry-run

# 2. Clean everything for fresh start
trokky clean --url https://dev.example.com/api --token TOKEN --confirm

# 3. Restore from production backup
trokky restore --url https://dev.example.com/api --token TOKEN --input prod-backup.zip --clean

# Or clean just specific collections
trokky clean --url https://dev.example.com/api --token TOKEN --collections articles,authors --confirm
```

### Complete Migration Workflow

```bash
# 1. Preview migration to see what would be transferred
trokky migrate --from https://staging.com/api --to https://dev.com/api \
  --from-token STAGING_READ_TOKEN --to-token DEV_WRITE_TOKEN --dry-run

# 2. Perform clean migration (recommended for fresh environment)
trokky migrate --from https://staging.com/api --to https://dev.com/api \
  --from-token STAGING_READ_TOKEN --to-token DEV_WRITE_TOKEN --clean

# 3. Selective migration of specific collections
trokky migrate --from https://prod.com/api --to https://staging.com/api \
  --from-token PROD_READ_TOKEN --to-token STAGING_WRITE_TOKEN \
  --collections articles,authors,media --clean
```

## OAuth2 SSO Configuration

Trokky can act as an OAuth2 Authorization Server, allowing external applications to authenticate users via your Trokky instance (Single Sign-On).

### Registering OAuth2 Clients

Add external applications to your `trokky.config.ts`:

```typescript
export default {
  // ... other config

  oauth2: {
    enabled: true,
    issuer: process.env.OAUTH2_ISSUER || 'http://localhost:3000',
    clients: [
      {
        id: 'my-web-app',
        name: 'My Web Application',
        description: 'External app that authenticates via Trokky',
        type: 'public',
        redirectUris: ['https://myapp.com/callback', 'http://localhost:4000/callback'],
        allowedScopes: ['openid', 'profile', 'content:read', 'offline_access'],
      },
      {
        id: 'my-backend-service',
        name: 'Backend Service',
        type: 'confidential',
        secret: process.env.OAUTH_CLIENT_SECRET,
        redirectUris: ['https://api.myapp.com/auth/callback'],
        allowedScopes: ['openid', 'profile', 'content:read', 'content:write'],
      },
    ],
  },
}
```

### Client Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `id` | string | Unique client identifier |
| `name` | string | Human-readable name shown on consent screen |
| `description` | string | Optional description shown on consent screen |
| `type` | `'public'` \| `'confidential'` | Public for SPAs/mobile apps, confidential for server-side apps |
| `secret` | string | Required for confidential clients |
| `redirectUris` | string[] | Allowed callback URLs (must match exactly) |
| `allowedScopes` | string[] | Scopes this client can request |

### Available Scopes

| Scope | Description |
|-------|-------------|
| `openid` | Access user identity |
| `profile` | Access user profile (username, email, name) |
| `content:read` | Read content from collections |
| `content:write` | Create and update content |
| `content:delete` | Delete content |
| `media:read` | Read media files |
| `media:write` | Upload media files |
| `offline_access` | Issue refresh tokens for long-lived access |

### Authorization Code Flow with PKCE

External applications use the Authorization Code Flow with PKCE:

1. **Redirect user to authorization endpoint:**
   ```
   GET /studio/auth/authorize?
     response_type=code&
     client_id=my-web-app&
     redirect_uri=https://myapp.com/callback&
     scope=openid%20profile%20content:read%20offline_access&
     state=random-state-value&
     code_challenge=BASE64URL(SHA256(code_verifier))&
     code_challenge_method=S256
   ```

2. **User authenticates and approves** on the Trokky consent screen

3. **Trokky redirects back** with authorization code:
   ```
   https://myapp.com/callback?code=AUTH_CODE&state=random-state-value
   ```

4. **Exchange code for tokens:**
   ```bash
   POST /api/auth/token
   Content-Type: application/json

   {
     "grant_type": "authorization_code",
     "code": "AUTH_CODE",
     "redirect_uri": "https://myapp.com/callback",
     "client_id": "my-web-app",
     "code_verifier": "original-code-verifier"
   }
   ```

5. **Response:**
   ```json
   {
     "access_token": "eyJ...",
     "token_type": "Bearer",
     "expires_in": 3600,
     "refresh_token": "eyJ...",
     "scope": "openid profile content:read offline_access"
   }
   ```

6. **Use access token** to call Trokky API:
   ```bash
   GET /api/auth/me
   Authorization: Bearer ACCESS_TOKEN
   ```

### Security Notes

- Always use HTTPS in production
- PKCE is required for all clients (prevents authorization code interception)
- Redirect URIs must match exactly (no wildcards)
- Unregistered clients receive `invalid_client` error
- Invalid redirect URIs are blocked (prevents open redirect attacks)

## Requirements

- Node.js 18+
- Trokky CMS instance
- Valid API tokens

## License

MIT

## Support

- [Documentation](https://trokky.dev)
- [GitHub Issues](https://github.com/Trokky/trokky/issues)
- [Community Discord](https://discord.gg/trokky)
