---
"@trokky/studio": patch
---

Fix Studio navigation styling and add scalable icon utility

- Add scalable icon utility (utils/icons.tsx) that supports multiple formats:
  - "hi:icon-name" for Heroicons
  - "fa:icon-name" for FontAwesome
  - "FaIconName" for legacy FontAwesome format
  - Plain names default to Heroicons
- Reduce document item size in navigation to be more coherent with category headers
- Icons from structure.ts now render correctly using the new utility
- FontAwesome icons are automatically mapped to equivalent Heroicons
- Collapsed sidebar now renders flat icon list instead of folder icons for groups
- Use native browser title attribute for tooltips in collapsed mode (fixes clipping issue)
