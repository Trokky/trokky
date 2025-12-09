---
"@trokky/trokky": patch
---

Improve CLI document update/create developer experience

- Auto-detect inline JSON arguments (no need for `--patch` or `--data` flags)
- Add client-side schema validation with helpful error messages
- Add field name suggestions for typos (using Levenshtein distance)
- Add type validation with expected/actual type display
- Add enum validation with available values
- Add `--no-validate` option to skip validation when needed
- Update documentation with new features and examples
