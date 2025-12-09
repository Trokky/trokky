---
"@trokky/trokky": minor
---

Add fluent query builder API and deprecate direct methods

- Add `client.from(collection)` fluent API for queries and mutations
- New chainable methods: `published()`, `draft()`, `filter()`, `limit()`, `offset()`, `order()`, `expand()`
- Query execution: `fetch()`, `fetchOne()`, `count()`
- Mutations: `create()`, `update()`, `patch()`, `delete()`
- Deprecate `getDocument()`, `queryDocuments()`, `createDocument()`, `updateDocument()`, `deleteDocument()`
- Deprecated methods will be removed in next major version
- Update documentation with new fluent API examples
