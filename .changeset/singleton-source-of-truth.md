---
"@trokky/trokky": patch
---

Make the schema the single source of truth for singletons.

Whether a collection holds exactly one document was answered three different ways: the PUT upsert read `schema.singleton`, while the create guard and read-time auto-creation walked the project's structure and, with no structure function configured, fell back to a hardcoded list of collection names. The CLI reads the schema flag. A project that declared a singleton in only one place therefore got a system where half the feature worked, and the divergence stayed invisible until a backup was restored — restore preserves ids for singletons and regenerates them otherwise, so the structure ended up pointing at documents that no longer existed.

All call sites now read the schema. A `type: 'singleton'` structure entry only decides which document id the navigation opens and whether to auto-create it.

- The hardcoded `homePage` / `settings` / `config` / `siteSettings` fallbacks are removed. In the create guard they matched on collection name alone, so a project without a custom structure could silently acquire singleton enforcement under an invented document id.
- A structure supplied as a plain object instead of a function is now handled; it previously fell through to those hardcoded names.
- `options.autoCreate: false` is now honoured, having been validated and documented but only logged.
- Auto-creation is limited to the singleton's own document id, so a read can no longer mint a document under an arbitrary id.
- `TrokkyExpress.create()` now fails at startup, naming each offending collection, when the structure presents a collection as a singleton that its schema does not declare.
