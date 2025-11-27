# Trokky Known Issues

This document tracks known bugs and issues in Trokky that need investigation and fixing.

---

## 🐛 Issue #1: TrokkyClient queryDocuments filter not working

**Severity:** High
**Component:** `@trokky/client`
**Status:** Open
**Reported:** 2025-11-03
**Affects:** v0.1.x

### Description

The `filter` parameter in `client.queryDocuments()` does not work correctly. When applying a filter, the API returns an empty result set even though matching documents exist.

### Expected Behavior

When calling:
```typescript
const result = await client.queryDocuments('job-posting', {
  filter: { slug: { $eq: 'developpeur-web' } }
});
```

Should return documents matching the filter criteria.

### Actual Behavior

Returns empty result:
```json
{
  "data": [],
  "total": 0,
  "offset": 0,
  "limit": 25,
  "hasMore": false
}
```

### Reproduction Steps

1. Create a collection with documents that have a `slug` field
2. Use `@trokky/client` to query with a filter:
   ```typescript
   import { TrokkyClient } from '@trokky/client';

   const client = new TrokkyClient({
     baseUrl: 'http://localhost:3000/api',
     apiToken: 'your-token'
   });

   const result = await client.queryDocuments('job-posting', {
     filter: { slug: { $eq: 'developpeur-web' } }
   });

   console.log(result.data); // Returns empty array
   ```

3. Verify the document exists by fetching all:
   ```typescript
   const all = await client.queryDocuments('job-posting');
   console.log(all.data.documents.find(doc => doc.slug === 'developpeur-web'));
   // Document exists!
   ```

### Evidence

**Backend API test (works correctly):**
```bash
# Direct API call with Bearer token
curl "http://localhost:3000/api/collections/job-posting" \
  -H "Authorization: Bearer TOKEN"
# Returns 6 documents including one with slug "developpeur-web"
```

**TrokkyClient test (fails):**
```typescript
// Client logs show filter is being sent but returns empty:
[DEBUG] getJobPosting - Result: {
  "data": [],
  "total": 0,
  "offset": 0,
  "limit": 25,
  "hasMore": false
}
```

### Root Cause Analysis Needed

Possible causes:
1. **Filter serialization issue**: The filter object might not be correctly serialized when sent to the API
2. **API endpoint mismatch**: The client might be using a different endpoint that doesn't support filtering
3. **Query parameter encoding**: Filter might need special encoding (URL encoding, JSON stringification)
4. **API authentication issue**: Filter queries might require different permissions

### Workaround

Fetch all documents and filter in-memory:

```typescript
export async function getJobPosting(slug: string) {
  // Fetch all documents
  const result = await client.queryDocuments('job-posting');
  const documents = result.data?.documents || result.documents || result.data || [];

  // Filter in-memory
  return documents.find((doc: any) => doc.slug === slug) || null;
}
```

### Investigation Required

1. Check `@trokky/client` source code:
   - Location: `/Users/amen/Projects/perso/trokky/packages/client/src/index.ts`
   - Review how `queryDocuments` method handles the `filter` parameter
   - Check if filters are being sent in query params, body, or headers

2. Check backend API:
   - Verify `/api/collections/:collection` endpoint supports filter query parameter
   - Check expected filter format
   - Review backend logs for incoming filter requests

3. Test direct API calls:
   ```bash
   # Test if backend supports filter parameter
   curl "http://localhost:3000/api/collections/job-posting?filter={\"slug\":{\"$eq\":\"developpeur-web\"}}" \
     -H "Authorization: Bearer TOKEN"
   ```

### Impact

- **Production sites using filtering**: ⚠️ Breaking - filters don't work
- **Workaround available**: ✅ Fetch all and filter in-memory (performance concern for large datasets)
- **Affects SSR**: ✅ Yes - dynamic routes can't filter efficiently

### Related Files

- `@trokky/client`: `/Users/amen/Projects/perso/trokky/packages/client/`
- Backend API: `/Users/amen/Projects/perso/trokky/packages/express/src/routes/`
- Real-world usage: `/Users/amen/Projects/perso/a production site-trokky/frontend/src/lib/trokky-client.ts:621`

### Priority

**High** - This affects any production site that needs to query specific documents by field values, which is a core CMS functionality.

---

## Adding New Issues

To add a new issue to this document:

1. Create a new section with format: `## 🐛 Issue #N: Title`
2. Include: Severity, Component, Status, Date, Affects version
3. Provide clear reproduction steps
4. Include evidence (logs, code samples)
5. Document workarounds if available
6. Mark priority (Low/Medium/High/Critical)
## Known Issues

### @trokky/adapter-filesystem TypeScript errors (2024-11)

Build fails with TypeScript errors related to `byteLength` property:

```
src/__tests__/fixtures/test-data.ts(49,52): error TS2339: Property 'byteLength' does not exist on type 'never'.
src/filesystem-adapter.ts(513,52): error TS2339: Property 'byteLength' does not exist on type 'never'.
src/filesystem-adapter.ts(1503,52): error TS2339: Property 'byteLength' does not exist on type 'never'.
```

Likely cause: TypeScript type narrowing issue with Buffer/ArrayBuffer types.

**To fix:** Check the type guards around buffer operations in those lines.

