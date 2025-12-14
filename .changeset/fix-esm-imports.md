---
"@trokky/adapter-filesystem-media": patch
"@trokky/adapter-filesystem-data": patch
"@trokky/structure": patch
"@trokky/express": patch
"@trokky/studio": patch
---

Fix ESM import issues by adding explicit .js extensions to relative imports

Node.js ESM requires explicit .js extensions for relative imports. This fix ensures proper module resolution when using these packages in ESM environments.
