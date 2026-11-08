---
"@trokky/trokky": patch
---

Fix: a password set while editing a user in Studio now works at sign-in. `PUT /users/:id` copied the new password into the user record without hashing it, so the old password hash stayed in place and the new password was refused. `updateUser` now validates the new password and stores only its hash, and the users API refuses a client-supplied `passwordHash`. With the filesystem data adapter, the clear-text password was also written to the user's JSON file (it was never returned by the API); the adapter now drops that key on the next write to the user, such as a sign-in. Postgres and D1 never stored it.
