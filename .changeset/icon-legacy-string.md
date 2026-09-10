---
"@trokky/studio": patch
---

Accept legacy string icon values instead of failing validation on them.

Icon values used to be plain FontAwesome class strings (`"fas fa-user"`), and documents written before the field became structured still hold them. The editor has always rendered those — `component.tsx` carried a parser for exactly this case — but `validate()` called `safeParse` on the raw value, so Zod rejected every one with `Expected object, received string`.

Because the Studio validates the whole document on save, editing a single unrelated field surfaced an error on every legacy icon at once, and none of them could be fixed from the UI. On a real site, changing one line of hero subtitle text produced validation errors on four other sections. The same edit succeeded on 0.1.x, so upgrading is what broke it.

The parser the component already had is now exported as `normalizeIconValue` and used by validation, the component and the allowed-libraries check, so all three agree on what a value means. FontAwesome class strings, JSON-encoded objects and the object form are all accepted; anything genuinely unusable becomes `null`, which the nullable schema allows unless the field is required.

No data migration is needed for documents holding string icons.
