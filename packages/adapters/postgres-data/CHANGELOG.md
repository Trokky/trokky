# @trokky/adapter-postgres-data

## 0.1.2

### Patch Changes

- 9a7f248: Replace direct console statements with proper logger system

  All console.log, console.warn, and console.error statements have been replaced with the unified logger system for better log control and consistency.

  Changes:
  - @trokky/core: Added loggers to media processors (sharp, cloudflare-transform-store, workers-images)
  - @trokky/routes: Replaced console statements in slug validation and auth endpoints with logger calls
  - @trokky/express: Added loggers to adapter and media-rewrite-middleware
  - @trokky/adapter-postgres-data: Changed connection pool logs from info to debug level

  Benefits:
  - Consistent logging format across all packages
  - Logs can be controlled via log levels (debug, info, warn, error)
  - Reduced log noise in production environments

- Updated dependencies [9a7f248]
  - @trokky/core@0.1.4
