---
"@trokky/core": patch
---

Fix API token performance by using SHA256 instead of bcrypt

- API tokens now use SHA256 hashing instead of bcrypt for both creation and validation
- This dramatically improves API request performance (~100ms -> ~1ms per token check)
- Bcrypt is slow by design (for passwords), but API tokens are long random strings that don't need bcrypt's protections
- Uses constant-time comparison (timingSafeEqual) to prevent timing attacks

BREAKING: Existing API tokens created with bcrypt hashes will need to be regenerated after this update.
