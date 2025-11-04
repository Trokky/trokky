---
"@trokky/trokky": patch
---

Add schema evolution handling to restore command

The restore command now handles schema evolution issues that cause validation
failures when restoring old backups to updated schemas. This fixes issues like
nullable fields becoming non-nullable or old media formats being incompatible
with new schemas.

Changes:
- Add sanitizeDocument() function to clean documents before restoration
- Remove null values (schemas may have changed from nullable to non-nullable)
- Remove empty objects (may have required nested fields in new schema)
- Remove old media format (src-based instead of asset._ref)

Results:
- 100% restoration success rate (115/115 documents vs 112/115 before)
- Fixes mega-menu validation failures (featuredContent.image: Invalid input)
- Fixes reseau-page validation failures (heroSubtitle: Expected string, received null)
- Maintains all reference updates (27 references) and media restoration (43 files)
