---
"@trokky/routes": patch
"@trokky/studio": patch
---

Add bulk selection and delete for media files in Studio

- Add checkboxes to media grid and list views for selecting multiple files
- Add bulk actions toolbar with "Delete Selected" button when items are selected
- Add keyboard shortcuts: Cmd/Ctrl+A to select all, Escape to clear, Delete/Backspace to delete selected
- Add Shift+click for range selection
- Add bulk delete API endpoint (POST /media/bulk-delete) with up to 100 files at once
- Add confirmation modal for bulk delete operations
