---
"@trokky/studio": patch
"@trokky/fields": patch
---

Add support for custom SVG path icons

Studio navigation:
- Add `svg:path-data` format for custom SVG icons with stroke style
- Add `svg-fill:path-data` format for custom SVG icons with fill style
- Add `svg[viewBox]:path-data` format for custom viewBox (e.g., `svg[0 0 20 20]:M12...`)
- Default viewBox is `0 0 24 24` to match Heroicons

IconField:
- Add `customIcons` option to define a reusable custom icon library
- Custom icons appear in searchable grid in Custom SVG tab
- Toggle to "Paste new SVG" for ad-hoc custom icons
- Live preview with stroke/fill style toggle
- SVG path data stored in the `svg` field of IconValue
- Export `CustomIconDefinition` type, `setCustomIcons`, `getCustomIcons`, `clearCustomIcons`, `renderSvgPath`

Example usage:
```ts
// icons.ts - Define custom icon library
export const myCustomIcons: Record<string, CustomIconDefinition> = {
  'gavel': {
    path: 'M12 3l1.5 1.5L9 9...',
    style: 'stroke',
    label: 'Gavel',
    category: 'legal',
    tags: ['law', 'judge'],
  },
};

// schema.ts - Use in IconField
{
  type: 'icon',
  options: {
    libraries: ['fontawesome', 'heroicons', 'custom'],
    customIcons: myCustomIcons,
  }
}
```
