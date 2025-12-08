---
"@trokky/trokky": minor
---

Add --fields and --set options to documents CLI commands

- `docs get --fields`: Select specific fields using dot-notation paths (e.g., `--fields title,meta.description`)
- `docs update --set`: Update specific field paths without sending the whole document (e.g., `--set "title=New Title" --set "meta.published=true"`)
