export { PostgresDataAdapter, PostgresTransaction } from './postgres-data-adapter.js'
export type {
  PostgresDataAdapterConfig,
  DocumentRow,
  UserRow,
  AppTokenRow,
  AuditLogRow,
  WebhookRow,
  SettingsRow,
  MigrationRow
} from './types.js'

// Auto-register adapter in global registry when imported
import { registerAdapter } from '@trokky/core'
import { PostgresDataAdapter } from './postgres-data-adapter.js'
import type { PostgresDataAdapterConfig } from './types.js'

registerAdapter({
  name: 'postgres-data',
  type: 'data',
  environments: ['node'],
  factory: (config: PostgresDataAdapterConfig) => {
    return new PostgresDataAdapter(config)
  }
})