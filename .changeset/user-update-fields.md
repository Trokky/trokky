---
"@trokky/trokky": patch
---

Fix: unticking Active when editing a user in Studio now deactivates them. `PUT /users/:id` did not map Studio's `active` field to `isActive`, so the account kept signing in; `active` must now be a boolean.

Security fixes in user management and webhooks:

- Webhooks no longer receive secrets carried by user events: the plain password-reset token (`user.password_reset_requested`), the email OTP code (`user.mfa_otp_requested`), invite tokens, and the user's password hash, MFA data, passkeys, linked OAuth accounts and preferences. A webhook subscribed to `user.*` could previously reset any account's password. In-process listeners, such as the mail notifications, still get the full event.
- A non-admin holding `users:write` can manage users but can no longer create, change or delete an admin account, or give anyone the admin role (403). Previously they could set an admin's password and sign in as them.
- Nobody can change their own role, permissions or active state through `PUT /users/:id` (403), so an admin cannot lock themselves out. Studio's edit form, which sends these fields unchanged, still works.
- `PUT /users/:id` accepts only the fields the edit form changes (`username`, `email`, `firstName`, `lastName`, `fullName`, `role`, `permissions`, `isActive`/`active`, `profileImage`, `preferences`, `password`), ignores `id` and timestamps, and refuses anything else with a 400. MFA, passkeys and linked OAuth accounts can no longer be written through it; they have their own endpoints.
- The users API shows whether MFA is on and with which methods, but no longer returns TOTP secrets, backup code hashes or trusted devices.
- Setting a password through `PUT /users/:id` emits `user.password_changed`, like change-password and password reset.
