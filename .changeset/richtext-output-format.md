---
"@trokky/fields": minor
"@trokky/studio": patch
---

Add configurable output format for richtext fields

Richtext fields now support three output formats via the `outputFormat` option:

- `html` (default): HTML string - backwards compatible with existing content
- `prosemirror`: ProseMirror/TipTap JSON document structure - preserves exact editor state
- `markdown`: Markdown string - git-friendly and portable

Example usage:

```typescript
fullMessage: {
  type: "richtext",
  title: "Content",
  options: {
    outputFormat: "prosemirror" // or "html" (default) or "markdown"
  }
}
```

This change is backwards compatible - existing richtext fields continue to use HTML format by default.
