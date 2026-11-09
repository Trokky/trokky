---
'@trokky/trokky': patch
---

Claiming a new site works on Postgres. The Studio's claim form asks for a username, email and password only, and the Postgres adapter wrote the missing first and last names as NULL into columns that do not allow it, so every claim failed with a 500 and a Postgres site created without `adminUser` had no way to get an administrator. Users without names are now stored with empty names, and clearing a name stores an empty one. A successful claim is also no longer written to the audit log as FAILED.
