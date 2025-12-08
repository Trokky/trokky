---
"@trokky/core": minor
"@trokky/routes": minor
"@trokky/client": minor
"trokky": minor
---

feat: add server-side reference expansion support

Added server-side reference expansion via the `expand` query parameter. Documents with reference fields can now return fully expanded referenced documents instead of just reference metadata.

**API Changes:**
- GET `/api/collections/:collection/:id?expand=field1,field2[]` - expand specific fields
- GET `/api/collections/:collection?expand=*` - expand all reference fields
- Use `[]` suffix for array reference fields (e.g., `categories[]`)

**@trokky/core:**
- New `expandDocumentReferences()` utility for expanding references in documents
- New `parseExpandParam()` for parsing expand query parameter
- Exports `ReferenceValue`, `ExpandOptions`, `DocumentFetcher` types

**@trokky/routes:**
- Document GET and list endpoints now support `expand` query parameter

**@trokky/client:**
- `QueryBuilder.expand()` method now uses server-side expansion
- `SingletonBuilder.expand()` method now uses server-side expansion
- Falls back to client-side expansion for backward compatibility

**trokky CLI:**
- `trokky docs get` now supports `--expand` option
