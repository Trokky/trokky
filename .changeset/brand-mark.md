---
'@trokky/studio': patch
---

Studio wears the real Trokky mark. The header placeholder was a primary-tinted square with a
letter T, and the tab had no icon at all: the built document points `rel="icon"` at
`/trokky-icon.svg`, which is only correct when Studio is mounted at the origin root, so both
server paths stripped the link. The mark now ships inline — as an SVG component in the header
when an instance sets no `branding.logo`, and as a data URI favicon that needs no route and
survives any mount point.
