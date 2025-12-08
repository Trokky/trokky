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
- Add "Custom SVG" tab allowing users to paste their own SVG path data
- Live preview of custom SVG with stroke/fill style toggle
- Optional name field for the custom icon
- SVG path data stored in the `svg` field of IconValue
- Export `customSvgAdapter`, `registerCustomIcon`, and `renderSvgPath` utilities

Example usage in structure.ts:
```ts
{
  type: 'singleton',
  title: 'Custom Page',
  schemaType: 'customPage',
  icon: 'svg:M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'
}
```
