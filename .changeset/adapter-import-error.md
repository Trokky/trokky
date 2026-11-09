---
'@trokky/trokky': patch
---

When the configured storage adapter is not registered, the startup error now gives the fix. Adapters register themselves when their module is imported, so the usual cause is a missing import, not a missing package:

```
Data adapter "postgres-data" is not registered (registered data adapters: filesystem-data). Adapters register themselves when imported: add

  import '@trokky/trokky/adapters/postgres-data'

to the file that creates the server, before it runs. If the import is there, check that your bundler keeps side-effect imports.
```

A media adapter configured under `storage.data` (or the reverse) is called out as such, and a near miss such as `postgres` suggests `postgres-data`.

The Express integration no longer appends its own list of adapters to this error. That list named packages that do not exist (`@trokky/adapter-filesystem-data`, `@trokky/adapter-dynamodb`), left out `postgres-data`, and told the reader to install a package.
