---
"@trokky/client": patch
---

Add local schema path support for type generation

**New Features:**
- Added `--schema-path` option to CLI for generating types from local schema files
- New `generateTypesFromPath()` function for programmatic usage

**CLI Usage:**
```bash
# From local compiled schemas (requires npm run build in CMS)
npx trokky-client generate-types --schema-path ../cms/dist/schemas -o ./src/types/cms

# From remote API (existing)
npx trokky-client generate-types --schema-url http://localhost:3000/api/collections --auth-token TOKEN -o ./src/types/cms
```

**Programmatic Usage:**
```typescript
import { generateTypesFromPath } from '@trokky/client/generator'

await generateTypesFromPath({
  schemaPath: '../cms/dist/schemas',
  outputDir: './src/types/cms',
  namespace: 'Trokky',
  includeValidation: true
})
```

**Bug Fixes:**
- Fixed index.ts exports using `.js` extension (now extension-less for better compatibility)

**Notes:**
- Local schema path requires compiled JS files (run `npm run build` in CMS first)
- When using with Vite, you may see dynamic import warnings which can be safely ignored
