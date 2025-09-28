# @trokky/adapter-postgres-data

PostgreSQL-based data storage adapter for Trokky CMS. Provides high-performance, ACID-compliant storage with advanced JSON querying capabilities for a data lake architecture.

## Features

- **JSONB Document Storage**: Flexible document storage with rich querying capabilities
- **Full ACID Transactions**: Complete transaction support for complex operations
- **Connection Pooling**: Production-ready connection management with configurable pools
- **Auto-Migration**: Automatic database schema setup and migration support
- **Performance Optimized**: Strategic indexes on collections, timestamps, and JSON fields
- **Audit Logging**: Complete audit trail with structured logging
- **Data Lake Ready**: Analytics-friendly schema design for complex queries

## Installation

```bash
npm install @trokky/adapter-postgres-data pg
```

## Quick Start

```typescript
import { TrokkyExpress } from '@trokky/express'

const trokky = await TrokkyExpress.create({
  storage: {
    data: {
      adapter: 'postgres-data',
      options: {
        connection: 'postgresql://user:pass@localhost:5432/trokky',
        schema: 'public',
        tablePrefix: 'trokky_'
      }
    }
  }
})

trokky.mount(app)
```

## Configuration Options

### Connection Configuration

```typescript
interface PostgresDataAdapterConfig {
  // Database connection (string or pg.PoolConfig)
  connection?: string | PoolConfig

  // Connection pool settings
  pool?: {
    max?: number                    // Max connections (default: 20)
    idleTimeoutMillis?: number      // Idle timeout (default: 30000)
    connectionTimeoutMillis?: number // Connection timeout (default: 2000)
  }

  // Database schema settings
  schema?: string           // Schema name (default: 'public')
  tablePrefix?: string      // Table prefix (default: 'trokky_')

  // Migration and setup
  autoMigrate?: boolean     // Auto-create tables (default: true)

  // Development features
  enableQueryLogging?: boolean // Log queries (default: false)

  // Security
  ssl?: boolean | object    // SSL configuration
  connectionTimeout?: number // Connection timeout in ms
}
```

### Environment Variables

The adapter supports these environment variables:

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/trokky
TROKKY_DB_SCHEMA=public
TROKKY_DB_PREFIX=trokky_
TROKKY_DB_SSL=true
```

## Database Schema

The adapter creates the following tables:

### Documents Table
```sql
CREATE TABLE trokky_documents (
  collection VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  PRIMARY KEY (collection, id)
);

-- Performance indexes
CREATE INDEX trokky_documents_collection_idx ON trokky_documents (collection);
CREATE INDEX trokky_documents_updated_at_idx ON trokky_documents (updated_at DESC);
CREATE INDEX trokky_documents_data_gin_idx ON trokky_documents USING GIN (data);
```

### Audit Logs Table
```sql
CREATE TABLE trokky_audit_logs (
  id VARCHAR(255) PRIMARY KEY,
  operation VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  actor_type VARCHAR(50) NOT NULL,
  actor_id VARCHAR(255) NOT NULL,
  changes JSONB,
  metadata JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Audit indexes
CREATE INDEX trokky_audit_logs_resource_idx ON trokky_audit_logs (resource_type, resource_id);
CREATE INDEX trokky_audit_logs_timestamp_idx ON trokky_audit_logs (timestamp DESC);
```

## Advanced Usage

### Custom Connection Pool

```typescript
import { Pool } from 'pg'

const trokky = await TrokkyExpress.create({
  storage: {
    data: {
      adapter: 'postgres-data',
      options: {
        connection: {
          host: 'localhost',
          port: 5432,
          database: 'trokky',
          user: 'trokky_user',
          password: process.env.DB_PASSWORD
        },
        pool: {
          max: 50,
          idleTimeoutMillis: 60000,
          connectionTimeoutMillis: 5000
        },
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      }
    }
  }
})
```

### Production Configuration

```typescript
const trokky = await TrokkyExpress.create({
  storage: {
    data: {
      adapter: 'postgres-data',
      options: {
        connection: process.env.DATABASE_URL,
        schema: 'cms',
        tablePrefix: 'trokky_',
        pool: {
          max: 20,
          idleTimeoutMillis: 30000
        },
        ssl: {
          rejectUnauthorized: false,
          ca: process.env.DB_SSL_CA
        },
        enableQueryLogging: false
      }
    }
  }
})
```

## Data Lake Querying

The PostgreSQL adapter enables advanced analytics queries:

### Complex JSON Queries
```sql
-- Find articles with specific tags
SELECT data FROM trokky_documents
WHERE collection = 'articles'
AND data->'tags' ? 'technology';

-- Analytics query for content trends
SELECT
  data->>'category' as category,
  COUNT(*) as count,
  DATE_TRUNC('month', created_at) as month
FROM trokky_documents
WHERE collection = 'articles'
GROUP BY category, month
ORDER BY month DESC;
```

### Performance Optimization
```sql
-- Custom indexes for specific queries
CREATE INDEX articles_status_idx ON trokky_documents
USING GIN ((data->'status'))
WHERE collection = 'articles';

-- Partial indexes for common filters
CREATE INDEX published_articles_idx ON trokky_documents (updated_at DESC)
WHERE collection = 'articles' AND data->>'status' = 'published';
```

## Migration and Backup

The adapter includes built-in migration support:

```typescript
// Migrations are automatically applied on startup
// Custom migrations can be added to the migration system
```

## Performance Monitoring

Enable query logging for development:

```typescript
{
  enableQueryLogging: true, // Logs all SQL queries
  connectionTimeout: 5000   // Monitor connection performance
}
```

## License

MIT - See LICENSE file for details.