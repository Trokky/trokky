---
"@trokky/trokky": patch
---

Add `trokky documents` command for quick content CRUD operations

This new command provides a better developer experience for document manipulation,
replacing the need to use curl for API interactions.

Features:
- `trokky docs list <collection>` - List documents with pagination, filtering, sorting
- `trokky docs get <collection> [id]` - Get a single document by ID
- `trokky docs create <collection>` - Create from file, stdin, or inline JSON
- `trokky docs update <collection> [id]` - Full or partial updates with --patch
- `trokky docs delete <collection> [ids...]` - Delete single or multiple documents

Key capabilities:
- Singleton support: ID is optional for singleton collections (auto-detected)
- Instance display: Shows which configured instance is being used
- Supports environment variables (TROKKY_URL, TROKKY_TOKEN) and configured instances
- `--pretty` flag for colorized JSON output
- `--ids-only` flag for piping to other commands (suppresses instance info)
- `--quiet` flag for scripting
- Stdin support for piped input
- Bulk delete with confirmation prompt (skip with --confirm)
- Better error messages: distinguishes "collection not found" from "not a singleton"

Alias: `trokky docs` works as shorthand for `trokky documents`
