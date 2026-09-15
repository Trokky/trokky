---
"@trokky/studio": minor
---

Serve Studio from a Worker: `createStudioFetchHandler` in `@trokky/studio/workers`.

`studioRouter` is Express and reads the built files from disk; a Worker has neither. The new handler serves Studio from the static assets binding: copy `@trokky/studio/dist` into your assets directory under the mount path at build time, and the handler hands hashed assets to the binding with immutable caching and serves the document — bootstrap config injected for the mount, asset URLs rewritten — for the root and every client-side route. Its failure mode when Studio was never copied says exactly which path it looked for.

The document transform is now a pure function, `transformStudioDocument`, with no filesystem in it.
