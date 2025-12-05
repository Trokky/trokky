---
"@trokky/client": patch
---

feat(client): Add fluent query builder and image URL builder APIs

New features for easier frontend development:

**Fluent Query Builder**
- `client.from('article')` - Start a chainable query
- `.published()` / `.draft()` - Filter by status
- `.where()` / `.eq()` / `.gt()` / `.lt()` etc. - Add filters
- `.expand('category')` - Auto-resolve reference fields
- `.sort()` / `.newest()` / `.oldest()` - Sort results
- `.limit()` / `.offset()` - Pagination
- `.fetch()` / `.first()` / `.count()` - Execute query

**Singleton Builder**
- `client.singleton('homepage')` - Fetch singleton documents
- `.expand()` - Resolve references in singletons
- `.fresh()` - Bypass cache

**Image URL Builder**
- `client.imageUrl(media).width(800).format('webp').url()` - Fluent URL building
- `client.createImageUrlBuilder()` - Create reusable factory
- `getSrcSet()` - Generate responsive srcset strings
- `getBestVariant()` - Auto-select best variant for viewport

**Server Helpers** (new `/server` export)
- `createMediaProxy()` - Generic media proxy factory
- `createAstroMediaProxy()` - Astro-specific handler
- `createNextMediaProxy()` - Next.js App Router handler
- `createExpressMediaProxy()` - Express middleware

All changes are backward compatible - existing code continues to work unchanged.
