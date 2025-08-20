/**
 * Split Storage Adapter Interfaces
 *
 * This file defines the new storage architecture that separates:
 * - DataStorageAdapter: Documents, users, and app tokens (structured data)
 * - MediaStorageAdapter: Files and media content (unstructured data)
 *
 * This enables optimal deployment patterns like:
 * - Cloudflare: D1 for data + R2 for media
 * - AWS: DynamoDB for data + S3 for media
 * - Hybrid: Filesystem for data + R2 for media
 */
export {};
//# sourceMappingURL=storage-adapters.js.map