---
"@trokky/studio": patch
---

Move the rich text editor to Tiptap 3, the router to react-router 7, and the build to Vite 8. Together these clear the bulk of the repository's open advisories, from 43 to 7.

Also fixes a bug the migration surfaced: in any document containing an image, typing scrambled the text — the first character landed at the caret and every one after it at the end of the document. The value-sync effect string-compared the editor's HTML against the stored value, but the two serialise images differently, so the guard was permanently true and re-set the content on every keystroke, re-anchoring the selection each time. Both sides now go through the same normalisation.
