---
"@trokky/trokky": minor
---

A Cloudflare D1 data adapter, written against the conformance suite.

```ts
import '@trokky/trokky/adapters/cloudflare-d1'

storage: { data: { adapter: 'cloudflare-d1', options: { database: env.DB } } }
```

It passes all 113 conformance tests (134 cases with the divergent-field matrix expanded) — the same suite the filesystem and Postgres adapters answer to, which exists because those two silently disagreed in eight ways. The suite runs against a **real D1**: Miniflare boots workerd and hands back a `D1Database`, so actual D1 semantics are exercised from an ordinary Node test run, with no separate runner. It has no external dependency, so unlike the Postgres runner it never skips.

SQLite differs from Postgres in ways that stay invisible until a test fails, so the notable choices are deliberate:

- **Timestamps come from JS, never from SQL.** SQLite's `CURRENT_TIMESTAMP` has one-second resolution, and the ordering fixtures are 20ms apart.
- **Document payloads are one JSON text blob**, so `0`, `false`, `''`, `null` and absent stay distinguishable.
- **Filters compare `json_type` as well as value**, because `json_extract` collapses JSON booleans to 0/1 and `false` would otherwise match a stored `0`.
- **Sorts use `json_extract`**, which yields real SQL numbers; the text accessors sort 13 before 2.
- **No `beginTransaction`.** D1 has no interactive transactions. The three places needing atomicity each do it in one statement: the document upsert via `ON CONFLICT`, `saveUserIf` via a conditional `UPDATE … RETURNING`, and `consumeAuthFlowState` via `DELETE … RETURNING`, which is what makes single-use auth state safe across isolates.

Also exports `@trokky/trokky/adapters/cloudflare-d1`, registering itself as `cloudflare-d1` for the `edge` and `cloudflare` environments.
