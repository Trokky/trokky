---
"@trokky/fields": patch
---

Fix richtext output to use relative URLs instead of absolute URLs

Images in HTML and Markdown formats now use relative paths (`/api/media/...`) instead of absolute URLs (`http://localhost:3000/api/media/...`) for portability across environments.
