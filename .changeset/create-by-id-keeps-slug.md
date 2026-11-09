---
'@trokky/trokky': patch
---

A create that names an existing document id (`POST /collections/:collection` with `id`) replaces that document, and no longer treats the document's own slug as taken. It used to come back with a suffix (`first` became `first-2`), which broke the document's URL; `trokky restore --preserve-ids` writes this way. Another document asking for the same slug still gets a unique one.
