---
"@trokky/studio": patch
---

Add support for custom SVG path icons in navigation

- Add `svg:path-data` format for custom SVG icons with stroke style
- Add `svg-fill:path-data` format for custom SVG icons with fill style
- Add `svg[viewBox]:path-data` format for custom viewBox (e.g., `svg[0 0 20 20]:M12...`)
- Default viewBox is `0 0 24 24` to match Heroicons

Example usage in structure.ts:
```ts
{
  type: 'singleton',
  title: 'Custom Page',
  schemaType: 'customPage',
  icon: 'svg:M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'
}
```
