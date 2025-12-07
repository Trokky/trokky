---
"@trokky/trokky": minor
---

Add `trokky documents` command for quick content CRUD operations

This new command provides a better developer experience for document manipulation,
replacing the need to use curl for API interactions.

Features:
- `trokky documents list <collection>` - List documents with pagination, filtering, sorting
- `trokky documents get <collection> <id>` - Get a single document by ID
- `trokky documents create <collection>` - Create from file, stdin, or inline JSON
- `trokky documents update <collection> <id>` - Full or partial updates with --patch
- `trokky documents delete <collection> <ids...>` - Delete single or multiple documents

Key capabilities:
- Supports environment variables (TROKKY_URL, TROKKY_TOKEN) and configured instances
- `--pretty` flag for colorized JSON output
- `--ids-only` flag for piping to other commands
- `--quiet` flag for scripting
- Stdin support for piped input
- Bulk delete with confirmation prompt (skip with --confirm)

Alias: `trokky docs` works as shorthand for `trokky documents`
