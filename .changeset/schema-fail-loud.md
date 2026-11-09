---
'@trokky/trokky': patch
---

Schema mistakes that used to pass silently are now reported, and `required` means required for every field type.

- **Unknown top-level schema keys** are still dropped, but now with a warning at startup naming the key and, when one is close, what was probably meant: `Schema "homepage": unknown key "isSingleton" is ignored (did you mean "singleton"?)`.
- **Field types nothing knows** (neither one of the 23 built-in types nor declared) get a warning naming the field path and the closest built-in type: `field "body" has type "richText" ... (did you mean "richtext"?)`. Such a field has no server validation and no Studio editor. A custom Studio field type is declared with `features.customFieldTypes: ['stars']`, which stops the warning.
- **`features.strictSchemas: true`** turns both warnings into a startup error listing every problem in the schema.
- **`required: true` is enforced for every field type.** The validator used to check presence only for some types: a required `media` or `date` field accepted `null`, and the fourteen types without a server-side case (`richtext`, `text`, `image`, `email`, ...) accepted anything, including nothing. Required fields of any type, including required properties inside `object` fields, now reject a missing or `null` value.
- Required items in an array (`of: { type: 'media', required: true }`) reject a `null` item, as required string items already did.
- Object fields written in array form inside a schema (`fields: [{ name: 'href', type: 'url', required: true }]`) are validated by field name. They were keyed by array index, so a required property in that form could never be satisfied.
- An auto-created singleton is still created when its schema has required fields, nested ones included: it is an empty document for an editor to fill in, and the required fields are checked when it is saved. Before, a singleton with a required `reference` or `media` field silently failed to auto-create.
- Unpublishing always works: a request that only sets `_status` to `draft` does not re-check required fields, so a document that predates a field becoming required can still be taken offline.

Upgrade note: a write that leaves a required field empty is now refused with a validation error for these types too. That covers editing or publishing a document saved before the upgrade with a required field empty (for example after a field was made required), and `trokky restore` of such a document. Fill the field, or make it optional, first.
