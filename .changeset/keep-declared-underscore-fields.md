---
"@trokky/trokky": patch
---

Stop discarding `_thumbnail` and other schema-declared underscore fields on write.

`stripSystemFields` in the document handlers and in `DocumentService` removed every top-level key beginning with `_` except `_status` and `_type`, to keep clients from shadowing storage-managed metadata. But the schema registry injects `_thumbnail` for the autoThumbnail feature, and a project may declare its own underscore-prefixed fields. Those are editor content. Every thumbnail set through the API — from Studio, from `trokky restore`, from any client — was silently dropped: the response said success and the stored document had no thumbnail. Values written under v0.1.x remained readable, which hid the regression.

Underscore keys that the collection's resolved schema declares as fields are now kept; undeclared ones are still stripped.
