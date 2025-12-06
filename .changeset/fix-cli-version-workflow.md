---
"@trokky/trokky": patch
---

Fix CLI version display and GitHub Actions workflow

- Read version dynamically from package.json instead of hardcoded value
- Fix release workflow that was preventing automatic publishing (remove custom check job that blocked release PR merges)
