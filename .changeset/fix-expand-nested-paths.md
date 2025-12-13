---
"@trokky/client": patch
---

Fix expand() to support nested field paths

- Added support for dot notation in expand() method (e.g., `documentation.featuredDocument`)
- Added `getNestedValue()` and `setNestedValue()` helpers to traverse object paths
- Fixed `extractDocument()` to properly unwrap API responses with collection wrappers
- Updated documentation with comprehensive examples for nested expansion and frontend integration
