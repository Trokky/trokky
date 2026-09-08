---
"@trokky/studio": patch
---

Fix reversed typing in portable text, and conditional hooks across the field layer.

`PortableTextField`'s `handleBlockInput` restored the caret by reading `editableDiv.firstChild?.firstChild`, expecting a span wrapper when the text node is itself `firstChild`. The lookup always returned nothing, so every keystroke was placed at offset 0 and text came out reversed.

Five field components returned before their hooks. `NumberField` and `TextareaField` threw "Rendered fewer hooks than expected" when the readonly flag flipped on a mounted instance. `ObjectField`, `ReferenceField` and `ColorField` sat behind a guard preceding every hook, so React threw nothing and silently discarded hook state instead: a typed colour reverted, an open modal closed, an open reference dropdown collapsed after a round trip through the guarded branch. Early returns now follow the hooks, and each hoisted effect is scoped to the mode it served.
