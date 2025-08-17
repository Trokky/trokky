# Migration Guide: From FilesystemAdapter to Split Storage

This guide helps you migrate from the deprecated `FilesystemAdapter` to the modern split storage architecture.

## Why Migrate?

The split storage architecture provides:
- **Better separation of concerns** - Data and media are handled independently
- **Improved scalability** - Different storage backends for different needs
- **Clearer configuration** - Explicit, declarative setup
- **Future flexibility** - Easy to mix storage adapters (e.g., filesystem data + S3 media)

## Migration Examples

### Basic Migration

**Before (Deprecated):**
```typescript
import { TrokkyCore } from '@trokky/core'
import { FilesystemAdapter } from '@trokky/adapter-filesystem'
import { TrokkyExpress } from '@trokky/express'

// Old way - deprecated
const adapter = new FilesystemAdapter({
  contentDir: './content',
  mediaDir: './media',
  createDirs: true,
  mediaBaseUrl: 'http://localhost:3000/api/media'
})

const core = new TrokkyCore(config, adapter, options)
const { router } = TrokkyExpress.setup({ core })
```

**After (Recommended):**
```typescript
import { TrokkyExpress } from '@trokky/express'

// New way - split storage architecture
const trokky = await TrokkyExpress.create({
  schemas: yourSchemas,
  
  storage: {
    data: {
      adapter: 'filesystem-data',
      options: {
        contentDir: './data/content',
        usersDir: './data/system/users',
        tokensDir: './data/system/tokens',
        webhooksDir: './data/system/webhooks',
        settingsDir: './data/system/settings',
        auditLogsDir: './data/system/audit-logs',
        createDirs: true,
        prettyJson: true
      }
    },
    media: {
      adapter: 'filesystem-media',
      options: {
        mediaDir: './data/media',
        createDirs: true,
        mediaBaseUrl: 'http://localhost:3000'
      }
    }
  },
  
  security: {
    adminUser: {
      username: 'admin',
      password: 'your-password'
    }
  }
})

// Auto-mount all routes
trokky.mount(app)
```

### Configuration Mapping

| Old FilesystemAdapter Config | New Split Storage Config |
|----------------------------|--------------------------|
| `contentDir` | `storage.data.options.contentDir` |
| `mediaDir` | `storage.media.options.mediaDir` |
| `usersDir` | `storage.data.options.usersDir` |
| `tokensDir` | `storage.data.options.tokensDir` |
| `webhooksDir` | `storage.data.options.webhooksDir` |
| `createDirs` | Both `storage.data.options.createDirs` and `storage.media.options.createDirs` |
| `prettyJson` | Both `storage.data.options.prettyJson` and `storage.media.options.prettyJson` |
| `mediaBaseUrl` | `storage.media.options.mediaBaseUrl` |

### Advanced Configuration

**Production with Mixed Storage:**
```typescript
const trokky = await TrokkyExpress.create({
  storage: {
    // Use filesystem for data (Git-friendly)
    data: {
      adapter: 'filesystem-data',
      options: {
        contentDir: './data/content',
        usersDir: './data/system/users',
        // ... other data options
      }
    },
    // Use S3 for media (scalable)
    media: {
      adapter: 's3-media',
      options: {
        bucket: 'my-media-bucket',
        region: 'us-east-1',
        // ... S3 options
      }
    }
  }
})
```

## Benefits of the New Architecture

### 1. **Separation of Concerns**
- Data storage (content, users, tokens) is separate from media storage
- Each can be optimized and scaled independently

### 2. **Better Configuration**
- Explicit, declarative configuration
- Environment-aware defaults with `withDefaults()`
- Type-safe configuration objects

### 3. **Improved Developer Experience**
- Single `TrokkyExpress.create()` call
- Auto-mounting with `trokky.mount(app)`
- Integrated user creation and security setup

### 4. **Future Flexibility**
- Easy to switch storage backends
- Mix different adapters for different needs
- Support for cloud-native deployments

## Breaking Changes

1. **Import Changes:**
   - No more direct `FilesystemAdapter` instantiation
   - Use `TrokkyExpress.create()` instead

2. **Configuration Structure:**
   - Nested `storage.data` and `storage.media` configuration
   - Different options for each storage type

3. **Initialization:**
   - Async `create()` method instead of synchronous constructor
   - Built-in user creation and security setup

## Migration Checklist

- [ ] Replace `new FilesystemAdapter()` with `TrokkyExpress.create()`
- [ ] Move configuration to `storage.data` and `storage.media` sections
- [ ] Update directory structure to use `data/` prefix
- [ ] Replace `TrokkyExpress.setup()` with `trokky.mount()`
- [ ] Test functionality with new configuration
- [ ] Update any custom middleware or route handling
- [ ] Update documentation and deployment scripts

## Troubleshooting

### Common Issues

**Issue:** Import errors after migration
```typescript
// ❌ This will show deprecation warnings
import { FilesystemAdapter } from '@trokky/adapter-filesystem'

// ✅ Use the new approach
import { TrokkyExpress } from '@trokky/express'
```

**Issue:** Directory structure conflicts
```bash
# Old structure
./content/
./media/
./users/

# New structure (recommended)
./data/content/
./data/media/
./data/system/users/
./data/system/tokens/
./data/system/webhooks/
```

**Issue:** Configuration not found
```typescript
// ❌ Missing required options
storage: {
  data: { adapter: 'filesystem-data' }  // Missing options
}

// ✅ Include required options
storage: {
  data: {
    adapter: 'filesystem-data',
    options: { contentDir: './data/content' }
  }
}
```

## Support

If you encounter issues during migration:

1. Check the [examples/demo](../examples/demo) for reference implementation
2. Review the [TrokkyExpress documentation](./EXPRESS.md)
3. Ensure all required options are provided in the new configuration format

The old `FilesystemAdapter` will continue to work but will show deprecation warnings. We recommend migrating to the split storage architecture for better maintainability and future compatibility.