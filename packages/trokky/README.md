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

Migrate content between different Trokky instances:

```bash
trokky migrate --from https://old-site.com/api --to https://new-site.com/api --from-token TOKEN1 --to-token TOKEN2
```

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
- Automatically updates media references during restore
- Handles cross-document relationships
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

Get API tokens from your Trokky Studio:
1. Go to `/studio` in your Trokky instance
2. Navigate to API Keys section
3. Generate tokens with appropriate permissions:
   - **Read** tokens for backup
   - **Write** tokens for restore/migration

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
