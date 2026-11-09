---
'@trokky/trokky': patch
'@trokky/studio': patch
---

`GET /system/doctor` reports the problems that otherwise fail silently, for `trokky doctor` in the CLI:

- **Signing key:** whether a real JWT secret is set, or the process signs with a random key.
- **Schemas:** unknown top-level keys and field types, as found at startup.
- **Storage persistence:** filesystem storage directories outside a volume, as found at startup in production, or why it was not checked.
- **Stored content:** every stored document is validated under the current schema rules. A document that fails cannot be saved until it is fixed, so it is reported as a failure, with the fields involved and its id. Document files that cannot be read at all (a corrupt JSON file, which listings skip) are failures too. Documents with no draft/published status are a warning. The scan pages by id and stops after 50,000 documents, saying so.

The report carries names, counts and ids only, never the key or field values. One scan runs at a time and its report is reused for a minute, so the endpoint cannot be used to load the database. It needs `settings:read`, which admins hold by default. CLI and agent sessions reach it through a new OAuth scope, `system:read`, which carries `settings:read` only for a user who holds it; the Studio's consent screens label it.

Data adapters may implement an optional `listUnreadableDocuments(collection)`; the filesystem adapter does.
