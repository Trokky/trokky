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
